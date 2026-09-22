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
    const hasWaitlistCookie = req.headers.get('cookie')?.includes('waitlist=1');

    if (mode === 'coming_soon') {
      if (isAppRoute) {
        url.pathname = '/coming-soon';
        return Response.redirect(url, 302);
      }
    } else if (mode === 'early_access') {
      if (isAppRoute) {
        // If they have already joined the waitlist, let them access the app routes (so they can log in if approved)
        if (hasWaitlistCookie) {
          return next();
        }
        
        // Otherwise, send them to the waitlist page
        url.pathname = '/early-access';
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
