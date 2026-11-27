import { createClient } from '@supabase/supabase-js'

// A publishable key is intended to be exposed in browser applications.
// Never put a Supabase secret or service_role key in frontend code.
const supabaseUrl = 'https://fwkmwgewiumdwfacilmk.supabase.co'
const supabasePublishableKey = 'sb_publishable_6dvXVhrO0pn3u_iJtAgRQw_yfdfQKFJ'

export const supabase = createClient(supabaseUrl, supabasePublishableKey)
