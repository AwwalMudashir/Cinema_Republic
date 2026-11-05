import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import Home from './pages/Home'
import About from './pages/About'
import Contact from './pages/Contact'
import Events from './pages/Events'
import Partnership from './pages/Partnership'
import Sessions from './pages/Sessions'
import SessionBooking from './pages/SessionBooking'
import PaymentCallback from './pages/PaymentCallback'
import TicketPage from './pages/TicketPage'
import BookingPage from './pages/BookingPage'
import ScrollToTop from './ScrollToTop';
import { PUBLIC_TICKETING_ENABLED, TICKETING_ADMIN_ENABLED } from './config/features';
const CheckIn = lazy(() => import('./pages/CheckIn'));
const AdminAuthProvider = lazy(() => import('./admin/AdminAuthProvider'));
const AdminFrame = lazy(() => import('./admin/AdminFrame'));
const RequireRole = lazy(() => import('./admin/AdminFrame').then((module) => ({ default: module.RequireRole })));
const AdminHome = lazy(() => import('./admin/AdminHome'));
const AdminLogin = lazy(() => import('./admin/AdminLogin'));
const AdminVenues = lazy(() => import('./admin/AdminVenues'));
const AdminOrders = lazy(() => import('./admin/AdminOrders'));
const AdminTeam = lazy(() => import('./admin/AdminTeam'));
const AdminPricing = lazy(() => import('./admin/AdminPricing'));
const AdminReception = lazy(() => import('./admin/AdminReception'));

const Display = () => {
  return (
    <>
      <ScrollToTop />
      <Suspense fallback={<main className="admin-loading" role="status">Loading workspace…</main>}><Routes>
        <Route path='/' element={<Home />} />
        <Route path='/about-us' element={<About />} />
        <Route path='/contact' element={<Contact />} />
        <Route path='/events' element={<Events />} />
        {PUBLIC_TICKETING_ENABLED ? <>
          <Route path='/tickets' element={<Sessions />} />
          <Route path='/tickets/:passType' element={<SessionBooking />} />
          <Route path='/sessions/*' element={<Navigate to='/tickets' replace />} />
          <Route path='/movies/*' element={<Navigate to='/tickets' replace />} />
          <Route path='/payment/callback' element={<PaymentCallback />} />
          <Route path='/ticket/:publicId' element={<TicketPage />} />
          <Route path='/booking/:publicId' element={<BookingPage />} />
        </> : <>
          <Route path='/tickets/*' element={<Navigate to='/' replace />} />
          <Route path='/sessions/*' element={<Navigate to='/' replace />} />
          <Route path='/movies/*' element={<Navigate to='/' replace />} />
          <Route path='/payment/callback' element={<Navigate to='/' replace />} />
          <Route path='/ticket/*' element={<Navigate to='/' replace />} />
          <Route path='/booking/*' element={<Navigate to='/' replace />} />
        </>}
        {TICKETING_ADMIN_ENABLED ? <>
          <Route path='/admin' element={<AdminAuthProvider><AdminFrame /></AdminAuthProvider>}>
            <Route index element={<AdminHome />} />
            <Route path='venues' element={<RequireRole roles={['admin', 'content_manager']}><AdminVenues /></RequireRole>} />
            <Route path='screenings/*' element={<Navigate to='/admin' replace />} />
            <Route path='pricing' element={<RequireRole roles={['admin', 'content_manager']}><AdminPricing /></RequireRole>} />
            <Route path='orders' element={<RequireRole roles={['admin']}><AdminOrders /></RequireRole>} />
            <Route path='reception' element={<RequireRole roles={['admin', 'cashier', 'supervisor', 'check_in_staff']}><AdminReception /></RequireRole>} />
            <Route path='team' element={<RequireRole roles={['admin']}><AdminTeam /></RequireRole>} />
            <Route path='check-in' element={<RequireRole roles={['admin', 'supervisor', 'check_in_staff']}><CheckIn /></RequireRole>} />
          </Route>
          <Route path='/admin/login' element={<AdminAuthProvider><AdminLogin /></AdminAuthProvider>} />
        </> : <Route path='/admin/*' element={<Navigate to='/' replace />} />}
        <Route path='/partnership' element={<Partnership />} />
        <Route path='*' element={<Navigate to='/' replace />} />
      </Routes></Suspense>
    </>
  )
}

export default Display
