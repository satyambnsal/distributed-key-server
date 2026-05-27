-- AwesomeIBE: Initial Schema for Distributed Identity-Based Encryption
-- Schema: awesomeibe

-- =============================================================================
-- CREATE SCHEMA
-- =============================================================================
CREATE SCHEMA IF NOT EXISTS awesomeibe;

-- =============================================================================
-- PROFILES (extends Supabase auth.users)
-- =============================================================================
CREATE TABLE awesomeibe.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    display_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_profiles_email ON awesomeibe.profiles(email);

-- =============================================================================
-- GROUPS (for group-based key access)
-- =============================================================================
CREATE TABLE awesomeibe.groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    created_by UUID REFERENCES awesomeibe.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_groups_name ON awesomeibe.groups(name);

-- =============================================================================
-- GROUP MEMBERS (many-to-many relationship)
-- =============================================================================
CREATE TABLE awesomeibe.group_members (
    group_id UUID REFERENCES awesomeibe.groups(id) ON DELETE CASCADE,
    user_id UUID REFERENCES awesomeibe.profiles(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
    added_by UUID REFERENCES awesomeibe.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    PRIMARY KEY (group_id, user_id)
);

CREATE INDEX idx_group_members_user ON awesomeibe.group_members(user_id);

-- =============================================================================
-- RESOURCES (encrypted files/data metadata)
-- =============================================================================
CREATE TABLE awesomeibe.resources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    resource_type TEXT DEFAULT 'file' CHECK (resource_type IN ('file', 'secret', 'message', 'folder')),
    metadata JSONB DEFAULT '{}'::jsonb,
    owner_id UUID REFERENCES awesomeibe.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_resources_key_id ON awesomeibe.resources(key_id);
CREATE INDEX idx_resources_owner ON awesomeibe.resources(owner_id);

-- =============================================================================
-- RESOURCE ACCESS (ACL for resource-based keys)
-- =============================================================================
CREATE TABLE awesomeibe.resource_access (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resource_id UUID REFERENCES awesomeibe.resources(id) ON DELETE CASCADE,
    principal_type TEXT NOT NULL CHECK (principal_type IN ('user', 'group')),
    principal_id UUID NOT NULL,
    permission TEXT NOT NULL CHECK (permission IN ('owner', 'write', 'read')),
    granted_by UUID REFERENCES awesomeibe.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE (resource_id, principal_type, principal_id)
);

CREATE INDEX idx_resource_access_principal ON awesomeibe.resource_access(principal_type, principal_id);
CREATE INDEX idx_resource_access_resource ON awesomeibe.resource_access(resource_id);

-- =============================================================================
-- KEY REQUEST AUDIT LOG
-- =============================================================================
CREATE TABLE awesomeibe.key_request_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES awesomeibe.profiles(id) ON DELETE SET NULL,
    user_email TEXT NOT NULL,
    key_id TEXT NOT NULL,
    server_id TEXT,
    granted BOOLEAN NOT NULL,
    denial_reason TEXT,
    ip_address INET,
    user_agent TEXT,
    requested_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_key_request_logs_user ON awesomeibe.key_request_logs(user_id);
CREATE INDEX idx_key_request_logs_key_id ON awesomeibe.key_request_logs(key_id);
CREATE INDEX idx_key_request_logs_requested_at ON awesomeibe.key_request_logs(requested_at DESC);

-- =============================================================================
-- ENCRYPTED BLOBS (store encrypted data in Supabase)
-- =============================================================================
CREATE TABLE awesomeibe.encrypted_blobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resource_id UUID REFERENCES awesomeibe.resources(id) ON DELETE CASCADE,
    sealed_data JSONB NOT NULL,
    original_filename TEXT,
    mime_type TEXT,
    size_bytes BIGINT,
    sha256_hash TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_encrypted_blobs_resource ON awesomeibe.encrypted_blobs(resource_id);

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

CREATE OR REPLACE FUNCTION awesomeibe.can_access_resource(
    p_user_id UUID,
    p_resource_id UUID,
    p_required_permission TEXT DEFAULT 'read'
) RETURNS BOOLEAN AS $$
DECLARE
    v_has_access BOOLEAN := FALSE;
    v_required_rank INT;
BEGIN
    v_required_rank := CASE p_required_permission
        WHEN 'owner' THEN 3
        WHEN 'write' THEN 2
        WHEN 'read' THEN 1
        ELSE 0
    END;

    -- Check direct user access
    SELECT TRUE INTO v_has_access
    FROM awesomeibe.resource_access ra
    WHERE ra.resource_id = p_resource_id
      AND ra.principal_type = 'user'
      AND ra.principal_id = p_user_id
      AND CASE ra.permission
            WHEN 'owner' THEN 3
            WHEN 'write' THEN 2
            WHEN 'read' THEN 1
            ELSE 0
          END >= v_required_rank;

    IF v_has_access THEN
        RETURN TRUE;
    END IF;

    -- Check group-based access
    SELECT TRUE INTO v_has_access
    FROM awesomeibe.resource_access ra
    JOIN awesomeibe.group_members gm ON gm.group_id = ra.principal_id
    WHERE ra.resource_id = p_resource_id
      AND ra.principal_type = 'group'
      AND gm.user_id = p_user_id
      AND CASE ra.permission
            WHEN 'owner' THEN 3
            WHEN 'write' THEN 2
            WHEN 'read' THEN 1
            ELSE 0
          END >= v_required_rank;

    RETURN COALESCE(v_has_access, FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if a user can access a key_id (used by key servers)
CREATE OR REPLACE FUNCTION awesomeibe.can_access_key(
    p_user_email TEXT,
    p_key_id TEXT
) RETURNS BOOLEAN AS $$
DECLARE
    v_user_id UUID;
    v_key_type TEXT;
    v_key_value TEXT;
    v_resource_id UUID;
BEGIN
    SELECT id INTO v_user_id
    FROM awesomeibe.profiles
    WHERE email = p_user_email;

    IF v_user_id IS NULL THEN
        RETURN FALSE;
    END IF;

    v_key_type := split_part(p_key_id, ':', 1);
    v_key_value := substring(p_key_id FROM position(':' IN p_key_id) + 1);

    CASE v_key_type
        WHEN 'user' THEN
            RETURN v_key_value = p_user_email;

        WHEN 'group' THEN
            RETURN EXISTS (
                SELECT 1
                FROM awesomeibe.group_members gm
                JOIN awesomeibe.groups g ON g.id = gm.group_id
                WHERE gm.user_id = v_user_id
                  AND g.name = v_key_value
            );

        WHEN 'resource' THEN
            SELECT id INTO v_resource_id
            FROM awesomeibe.resources
            WHERE key_id = p_key_id;

            IF v_resource_id IS NULL THEN
                RETURN FALSE;
            END IF;

            RETURN awesomeibe.can_access_resource(v_user_id, v_resource_id, 'read');

        WHEN 'public' THEN
            RETURN TRUE;

        ELSE
            RETURN FALSE;
    END CASE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================================================

ALTER TABLE awesomeibe.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE awesomeibe.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE awesomeibe.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE awesomeibe.resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE awesomeibe.resource_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE awesomeibe.key_request_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE awesomeibe.encrypted_blobs ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE POLICY "Profiles are viewable by authenticated users"
    ON awesomeibe.profiles FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Users can update their own profile"
    ON awesomeibe.profiles FOR UPDATE
    TO authenticated
    USING (auth.uid() = id);

-- Groups
CREATE POLICY "Groups are viewable by members"
    ON awesomeibe.groups FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM awesomeibe.group_members
            WHERE group_id = id AND user_id = auth.uid()
        )
        OR created_by = auth.uid()
    );

CREATE POLICY "Groups can be created by authenticated users"
    ON awesomeibe.groups FOR INSERT
    TO authenticated
    WITH CHECK (created_by = auth.uid());

CREATE POLICY "Groups can be updated by owners"
    ON awesomeibe.groups FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM awesomeibe.group_members
            WHERE group_id = id AND user_id = auth.uid() AND role = 'owner'
        )
    );

-- Group members
CREATE POLICY "Group members are viewable by group members"
    ON awesomeibe.group_members FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM awesomeibe.group_members gm
            WHERE gm.group_id = group_id AND gm.user_id = auth.uid()
        )
    );

CREATE POLICY "Group members can be added by owners/admins"
    ON awesomeibe.group_members FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM awesomeibe.group_members
            WHERE group_id = group_members.group_id
              AND user_id = auth.uid()
              AND role IN ('owner', 'admin')
        )
    );

-- Resources
CREATE POLICY "Resources are viewable by those with access"
    ON awesomeibe.resources FOR SELECT
    TO authenticated
    USING (
        owner_id = auth.uid()
        OR awesomeibe.can_access_resource(auth.uid(), id, 'read')
    );

CREATE POLICY "Resources can be created by authenticated users"
    ON awesomeibe.resources FOR INSERT
    TO authenticated
    WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Resources can be updated by owners"
    ON awesomeibe.resources FOR UPDATE
    TO authenticated
    USING (
        owner_id = auth.uid()
        OR awesomeibe.can_access_resource(auth.uid(), id, 'owner')
    );

-- Resource access
CREATE POLICY "Resource access is viewable by resource owners"
    ON awesomeibe.resource_access FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM awesomeibe.resources r
            WHERE r.id = resource_id
              AND (r.owner_id = auth.uid() OR awesomeibe.can_access_resource(auth.uid(), r.id, 'owner'))
        )
    );

CREATE POLICY "Resource access can be granted by owners"
    ON awesomeibe.resource_access FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM awesomeibe.resources r
            WHERE r.id = resource_id
              AND (r.owner_id = auth.uid() OR awesomeibe.can_access_resource(auth.uid(), r.id, 'owner'))
        )
    );

-- Key request logs
CREATE POLICY "Key request logs are viewable by the requesting user"
    ON awesomeibe.key_request_logs FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

-- Encrypted blobs
CREATE POLICY "Encrypted blobs are viewable by those with resource access"
    ON awesomeibe.encrypted_blobs FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM awesomeibe.resources r
            WHERE r.id = resource_id
              AND (r.owner_id = auth.uid() OR awesomeibe.can_access_resource(auth.uid(), r.id, 'read'))
        )
    );

CREATE POLICY "Encrypted blobs can be created by resource owners"
    ON awesomeibe.encrypted_blobs FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM awesomeibe.resources r
            WHERE r.id = resource_id
              AND (r.owner_id = auth.uid() OR awesomeibe.can_access_resource(auth.uid(), r.id, 'write'))
        )
    );

-- =============================================================================
-- TRIGGERS
-- =============================================================================

CREATE OR REPLACE FUNCTION awesomeibe.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_profiles_updated
    BEFORE UPDATE ON awesomeibe.profiles
    FOR EACH ROW EXECUTE FUNCTION awesomeibe.handle_updated_at();

CREATE TRIGGER on_groups_updated
    BEFORE UPDATE ON awesomeibe.groups
    FOR EACH ROW EXECUTE FUNCTION awesomeibe.handle_updated_at();

CREATE TRIGGER on_resources_updated
    BEFORE UPDATE ON awesomeibe.resources
    FOR EACH ROW EXECUTE FUNCTION awesomeibe.handle_updated_at();

-- Auto-create profile when user signs up
CREATE OR REPLACE FUNCTION awesomeibe.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO awesomeibe.profiles (id, email, display_name)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1))
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION awesomeibe.handle_new_user();

-- Auto-add creator as owner when group is created
CREATE OR REPLACE FUNCTION awesomeibe.handle_new_group()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO awesomeibe.group_members (group_id, user_id, role, added_by)
    VALUES (NEW.id, NEW.created_by, 'owner', NEW.created_by);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_group_created
    AFTER INSERT ON awesomeibe.groups
    FOR EACH ROW EXECUTE FUNCTION awesomeibe.handle_new_group();

-- Auto-add creator as owner when resource is created
CREATE OR REPLACE FUNCTION awesomeibe.handle_new_resource()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO awesomeibe.resource_access (resource_id, principal_type, principal_id, permission, granted_by)
    VALUES (NEW.id, 'user', NEW.owner_id, 'owner', NEW.owner_id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_resource_created
    AFTER INSERT ON awesomeibe.resources
    FOR EACH ROW EXECUTE FUNCTION awesomeibe.handle_new_resource();
