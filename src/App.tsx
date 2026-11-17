import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { lazy, Suspense, useEffect } from 'react';
import Index from './pages/Index';
import Services from './pages/Services';
import Training from './pages/Training';
import About from './pages/About';
import Contact from './pages/Contact';
import Pricing from './pages/Pricing';
import NotFound from './pages/NotFound';
import Booking from './pages/Booking';
import Confirmation from './pages/Confirmation';

// Staff only, so customers don't download the scanner code.
const Door = lazy(() => import('./pages/Door'));
const Admin = lazy(() => import('./pages/Admin'));
const EventSetup = lazy(() => import('./pages/EventSetup'));
const EventPage = lazy(() => import('./pages/EventPage'));

const queryClient = new QueryClient();

const ScrollToTop = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <ScrollToTop />
        <Routes>
          <Route path='/' element={<Index />} />
          <Route path='/booking' element={<Booking />} />
          <Route path='/booking/confirmation' element={<Confirmation />} />
          <Route
            path='/door'
            element={
              <Suspense fallback={<div className='min-h-screen bg-[#0B1F3F]' />}>
                <Door />
              </Suspense>
            }
          />
          <Route
            path='/admin'
            element={
              <Suspense fallback={null}>
                <Admin />
              </Suspense>
            }
          />
          <Route
            path='/events/setup'
            element={
              <Suspense fallback={null}>
                <EventSetup />
              </Suspense>
            }
          />
          <Route
            path='/events/:slug'
            element={
              <Suspense fallback={null}>
                <EventPage />
              </Suspense>
            }
          />
          <Route path='/services' element={<Services />} />
          <Route path='/training' element={<Training />} />
          <Route path='/about' element={<About />} />
          <Route path='/contact' element={<Contact />} />
          <Route path='/pricing' element={<Pricing />} />
          <Route path='*' element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
