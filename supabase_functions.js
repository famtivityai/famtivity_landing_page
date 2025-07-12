// Initialize Supabase client
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Waitlist submission
export async function submitToWaitlist(formData) {
    try {
        const { data, error } = await supabase
            .from('waitlist')
            .insert([
                {
                    email: formData.email,
                    first_name: formData.firstName,
                    zip_code: formData.zipCode,
                    family_size: parseInt(formData.familySize),
                    source: 'website'
                }
            ])
            .select()
            .single()

        if (error) throw error
        return { success: true, data }
    } catch (error) {
        console.error('Error submitting to waitlist:', error)
        return { success: false, error: error.message }
    }
}

// Family onboarding
export async function completeFamilyOnboarding(waitlistId, familyData, childrenData) {
    try {
        // Start a transaction
        const { data: familyProfile, error: familyError } = await supabase
            .from('family_profiles')
            .insert([
                {
                    waitlist_id: waitlistId,
                    monthly_budget: familyData.monthlyBudget,
                    max_travel_distance: parseInt(familyData.maxTravel),
                    preferred_times: familyData.preferredTimes
                }
            ])
            .select()
            .single()

        if (familyError) throw familyError

        // Insert children
        const childrenInserts = childrenData.map(child => ({
            family_id: familyProfile.id,
            name: child.name || null,
            age: parseInt(child.age),
            interests: child.interests,
            energy_level: child.energyLevel
        }))

        const { error: childrenError } = await supabase
            .from('children')
            .insert(childrenInserts)

        if (childrenError) throw childrenError

        // Update waitlist entry
        await supabase
            .from('waitlist')
            .update({ 
                user_role: 'family',
                completed_onboarding: true 
            })
            .eq('id', waitlistId)

        return { success: true, familyId: familyProfile.id }
    } catch (error) {
        console.error('Error completing onboarding:', error)
        return { success: false, error: error.message }
    }
}

// Get family dashboard data
export async function getFamilyDashboard(email) {
    try {
        // Get family profile
        const { data: familyData, error: familyError } = await supabase
            .from('family_profiles')
            .select(`
                *,
                waitlist!inner(email),
                children(*)
            `)
            .eq('waitlist.email', email)
            .single()

        if (familyError) throw familyError

        // Get recommendations for all children
        const childIds = familyData.children.map(child => child.id)
        
        const { data: recommendations, error: recError } = await supabase
            .from('activity_recommendations')
            .select(`
                *,
                activities(*)
            `)
            .in('child_id', childIds)
            .order('match_score', { ascending: false })
            .limit(10)

        if (recError) throw recError

        // Get upcoming bookings
        const { data: bookings, error: bookingsError } = await supabase
            .from('bookings')
            .select(`
                *,
                activities(*),
                children(*)
            `)
            .eq('family_id', familyData.id)
            .eq('status', 'confirmed')
            .gte('start_date', new Date().toISOString())
            .order('start_date')
            .limit(5)

        if (bookingsError) throw bookingsError

        return {
            success: true,
            data: {
                family: familyData,
                recommendations,
                upcomingBookings: bookings
            }
        }
    } catch (error) {
        console.error('Error fetching dashboard:', error)
        return { success: false, error: error.message }
    }
}

// Search activities
export async function searchActivities(filters) {
    try {
        let query = supabase
            .from('activities')
            .select('*')
            .eq('is_active', true)

        // Apply filters
        if (filters.category) {
            query = query.eq('category', filters.category)
        }

        if (filters.minAge && filters.maxAge) {
            query = query
                .lte('min_age', filters.maxAge)
                .gte('max_age', filters.minAge)
        }

        if (filters.maxPrice) {
            query = query.lte('price_per_month', filters.maxPrice)
        }

        // Location-based filtering would require a function call
        if (filters.userLat && filters.userLng && filters.maxDistance) {
            const { data, error } = await supabase
                .rpc('get_activities_within_distance', {
                    user_lat: filters.userLat,
                    user_lng: filters.userLng,
                    max_distance_km: filters.maxDistance
                })
            
            if (error) throw error
            return { success: true, data }
        }

        const { data, error } = await query

        if (error) throw error
        return { success: true, data }
    } catch (error) {
        console.error('Error searching activities:', error)
        return { success: false, error: error.message }
    }
}

// Book an activity
export async function bookActivity(familyId, activityId, childId, startDate) {
    try {
        const { data, error } = await supabase
            .from('bookings')
            .insert([
                {
                    family_id: familyId,
                    activity_id: activityId,
                    child_id: childId,
                    status: 'pending',
                    start_date: startDate
                }
            ])
            .select()
            .single()

        if (error) throw error
        return { success: true, data }
    } catch (error) {
        console.error('Error booking activity:', error)
        return { success: false, error: error.message }
    }
}

// Submit feedback
export async function submitFeedback(bookingId, feedbackData) {
    try {
        const { data, error } = await supabase
            .from('activity_feedback')
            .insert([
                {
                    booking_id: bookingId,
                    family_id: feedbackData.familyId,
                    child_id: feedbackData.childId,
                    activity_id: feedbackData.activityId,
                    overall_rating: feedbackData.overallRating,
                    child_enjoyment: feedbackData.childEnjoyment,
                    value_for_money: feedbackData.valueForMoney,
                    comments: feedbackData.comments
                }
            ])
            .select()
            .single()

        if (error) throw error
        return { success: true, data }
    } catch (error) {
        console.error('Error submitting feedback:', error)
        return { success: false, error: error.message }
    }
}
