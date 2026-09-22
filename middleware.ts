import { next } from '@vercel/edge';

export const config = {
  matcher: ['/((?!api|_vercel|.*\\..*).*)'],
};

export default async function middleware(req: Request) {
  try {
    const url = new URL(req.url);
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const anonKey = process.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !anonKey) {
      return next();
    }

    // Fetch the launch config from Supabase directly via REST
    const res = await fetch(`${supabaseUrl}/rest/v1/admin_settings?key=eq.launch_config&select=value`, {
      headers: {
        'apikey': anonKey,
        'Authorization': `Bearer ${anonKey}`
      }
    });

    if (!res.ok) return next();
    
    const data = await res.json();
    if (!data || data.length === 0) return next();

    const mode = data[0].value?.mode || 'live';
    const path = url.pathname;
    
    const isAppRoute = path.startsWith('/app');
    const isLoginIntent = url.searchParams.get('login') === 'true';
    
    // Check if they are likely already an existing user (have joined waitlist or have an auth session cookie)
    const cookies = req.headers.get('cookie') || '';
    const hasWaitlistCookie = cookies.includes('waitlist=1');
    const hasAuthCookie = cookies.includes('sb-') && cookies.includes('-auth-token');

    if (mode === 'coming_soon' || mode === 'early_access') {
      if (isAppRoute) {
        // Allow access to the app routes if they are existing users who want to log in
        if (isLoginIntent || hasAuthCookie || (mode === 'early_access' && hasWaitlistCookie)) {
          return next();
        }

        // Otherwise, they are a new user. Intercept them.
        url.pathname = mode === 'coming_soon' ? '/coming-soon' : '/early-access';
        return Response.redirect(url, 302);
      }
    } else if (mode === 'live') {
      if (path === '/coming-soon' || path === '/early-access') {
        url.pathname = '/';
        return Response.redirect(url, 302);
      }
    }

    return next();
  } catch (e) {
    return next();
  }
}
