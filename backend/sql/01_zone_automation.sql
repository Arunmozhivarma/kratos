-- ========================================
-- Zone Automation Solution
-- ========================================

-- 1. Fix data type consistency
-- First, ensure devices.lab_id matches zones.lab_id type
-- This migration should be run carefully to avoid data loss

-- 2. Function to create zones for all devices in a lab
CREATE OR REPLACE FUNCTION create_zones_for_lab(p_lab_id BIGINT)
RETURNS VOID AS $$
DECLARE
    device_record RECORD;
    default_zone_name TEXT := 'configBox1';
    default_coordinates JSONB := '[]'::JSONB;
BEGIN
    -- Start transaction for consistency
    -- Loop through all devices assigned to this lab
    FOR device_record IN 
        SELECT device_id 
        FROM public.devices 
        WHERE lab_id = p_lab_id::TEXT  -- Convert bigint to text for comparison
    LOOP
        -- Insert zone record if it doesn't already exist
        INSERT INTO public.zones (lab_id, device_id, zone_name, zone_coordinates, created_at, updated_at)
        VALUES (
            p_lab_id,
            device_record.device_id,
            default_zone_name,
            default_coordinates,
            NOW(),
            NOW()
        )
        ON CONFLICT (lab_id, device_id) DO NOTHING;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 3. Trigger to automatically create zones when a lab is created
CREATE OR REPLACE FUNCTION auto_create_zones_on_lab_creation()
RETURNS TRIGGER AS $$
BEGIN
    -- Create zones for the new lab
    PERFORM create_zones_for_lab(NEW.lab_id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Trigger to automatically create zones when a device is assigned to a lab
CREATE OR REPLACE FUNCTION auto_create_zones_on_device_assignment()
RETURNS TRIGGER AS $$
BEGIN
    -- Only create zone if lab_id is not null
    IF NEW.lab_id IS NOT NULL AND NEW.lab_id != '' THEN
        INSERT INTO public.zones (lab_id, device_id, zone_name, zone_coordinates, created_at, updated_at)
        VALUES (
            NEW.lab_id::BIGINT,  -- Convert text to bigint
            NEW.device_id,
            'configBox1',
            '[]'::JSONB,
            NOW(),
            NOW()
        )
        ON CONFLICT (lab_id, device_id) DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Create the triggers
DROP TRIGGER IF EXISTS trg_auto_create_zones_lab ON public.labs;
CREATE TRIGGER trg_auto_create_zones_lab
    AFTER INSERT ON public.labs
    FOR EACH ROW
    EXECUTE FUNCTION auto_create_zones_on_lab_creation();

DROP TRIGGER IF EXISTS trg_auto_create_zones_device ON public.devices;
CREATE TRIGGER trg_auto_create_zones_device
    AFTER INSERT OR UPDATE ON public.devices
    FOR EACH ROW
    WHEN (NEW.lab_id IS DISTINCT FROM OLD.lab_id OR OLD.lab_id IS NULL)
    EXECUTE FUNCTION auto_create_zones_on_device_assignment();

-- 6. Add unique constraint to prevent duplicate zones
ALTER TABLE public.zones 
ADD CONSTRAINT IF NOT EXISTS zones_lab_device_unique 
UNIQUE (lab_id, device_id);

-- 7. Bulk function to create zones for existing labs and devices
CREATE OR REPLACE FUNCTION create_zones_for_all_existing_labs()
RETURNS TABLE(lab_id BIGINT, zones_created INTEGER) AS $$
DECLARE
    lab_record RECORD;
    zones_count INTEGER;
BEGIN
    -- Process each lab
    FOR lab_record IN 
        SELECT lab_id FROM public.labs WHERE is_active = true
    LOOP
        -- Create zones for this lab
        PERFORM create_zones_for_lab(lab_record.lab_id);
        
        -- Count zones created for this lab
        SELECT COUNT(*) INTO zones_count
        FROM public.zones 
        WHERE lab_id = lab_record.lab_id;
        
        -- Return result
        lab_id := lab_record.lab_id;
        zones_created := zones_count;
        RETURN NEXT;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 8. Function to handle bulk device assignment to a lab
CREATE OR REPLACE FUNCTION bulk_assign_devices_to_lab(p_lab_id BIGINT, p_device_ids INTEGER[])
RETURNS TABLE(device_id INTEGER, zone_created BOOLEAN) AS $$
DECLARE
    device_id_val INTEGER;
    zone_created_val BOOLEAN;
BEGIN
    FOREACH device_id_val IN ARRAY p_device_ids
    LOOP
        -- Update device lab assignment
        UPDATE public.devices 
        SET lab_id = p_lab_id::TEXT
        WHERE device_id = device_id_val;
        
        -- Create zone if it doesn't exist
        INSERT INTO public.zones (lab_id, device_id, zone_name, zone_coordinates, created_at, updated_at)
        VALUES (p_lab_id, device_id_val, 'configBox1', '[]'::JSONB, NOW(), NOW())
        ON CONFLICT (lab_id, device_id) DO NOTHING;
        
        -- Check if zone was created
        zone_created_val := NOT EXISTS (
            SELECT 1 FROM public.zones 
            WHERE lab_id = p_lab_id AND device_id = device_id_val
        );
        
        device_id := device_id_val;
        zone_created := zone_created_val;
        RETURN NEXT;
    END LOOP;
END;
$$ LANGUAGE plpgsql;
