// supabase-auth.js
export async function signInWithGoogle() {
    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: process.env.NODE_ENV === 'production' 
                ? 'https://famtivity.com/dashboard'
                : 'http://localhost:3000/dashboard',
            scopes: 'email profile'
        }
    })
    
    if (error) throw error
    return data
}
