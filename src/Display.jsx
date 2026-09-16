import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import Home from './pages/Home'
import About from './pages/About'
import Contact from './pages/Contact'
import Events from './pages/Events'
import Partnership from './pages/Partnership'
import ScrollToTop from './ScrollToTop';
import Movies from './pages/Movies';
import MovieBooking from './pages/MovieBooking';
import PaymentCallback from './pages/PaymentCallback';
import TicketPage from './pages/TicketPage';
const CheckIn = lazy(() => import('./pages/CheckIn'));
const AdminAuthProvider = lazy(() => import('./admin/AdminAuthProvider'));
const AdminFrame = lazy(() => import('./admin/AdminFrame'));
const RequireRole = lazy(() => import('./admin/AdminFrame').then((module) => ({ default: module.RequireRole })));
const AdminHome = lazy(() => import('./admin/AdminHome'));
const AdminLogin = lazy(() => import('./admin/AdminLogin'));
const AdminMovies = lazy(() => import('./admin/AdminMovies').then((module) => ({ default: module.AdminMovies })));
const AdminMovieForm = lazy(() => import('./admin/AdminMovies').then((module) => ({ default: module.AdminMovieForm })));
const AdminVenues = lazy(() => import('./admin/AdminVenues'));
const AdminScreenings = lazy(() => import('./admin/AdminScreenings').then((module) => ({ default: module.AdminScreenings })));
const AdminScreeningForm = lazy(() => import('./admin/AdminScreenings').then((module) => ({ default: module.AdminScreeningForm })));
const AdminOrders = lazy(() => import('./admin/AdminOrders'));
const AdminTeam = lazy(() => import('./admin/AdminTeam'));

const Display = () => {
  return (
    <>
      <ScrollToTop />
      <Suspense fallback={<main className="admin-loading" role="status">Loading workspace…</main>}><Routes>
        <Route path='/' element={<Home />} />
        <Route path='/about-us' element={<About />} />
        <Route path='/contact' element={<Contact />} />
        <Route path='/events' element={<Events />} />
        <Route path='/movies' element={<Movies />} />
        <Route path='/movies/:slug' element={<MovieBooking />} />
        <Route path='/payment/callback' element={<PaymentCallback />} />
        <Route path='/ticket/:publicId' element={<TicketPage />} />
        <Route path='/admin' element={<AdminAuthProvider><AdminFrame /></AdminAuthProvider>}>
          <Route index element={<AdminHome />} />
          <Route path='movies' element={<RequireRole roles={['admin', 'content_manager']}><AdminMovies /></RequireRole>} />
          <Route path='movies/:id' element={<RequireRole roles={['admin', 'content_manager']}><AdminMovieForm /></RequireRole>} />
          <Route path='venues' element={<RequireRole roles={['admin', 'content_manager']}><AdminVenues /></RequireRole>} />
          <Route path='screenings' element={<RequireRole roles={['admin', 'content_manager']}><AdminScreenings /></RequireRole>} />
          <Route path='screenings/:id' element={<RequireRole roles={['admin', 'content_manager']}><AdminScreeningForm /></RequireRole>} />
          <Route path='orders' element={<RequireRole roles={['admin']}><AdminOrders /></RequireRole>} />
          <Route path='team' element={<RequireRole roles={['admin']}><AdminTeam /></RequireRole>} />
          <Route path='check-in' element={<RequireRole roles={['admin', 'check_in_staff']}><CheckIn /></RequireRole>} />
        </Route>
        <Route path='/admin/login' element={<AdminAuthProvider><AdminLogin /></AdminAuthProvider>} />
        <Route path='/partnership' element={<Partnership />} />
      </Routes></Suspense>
    </>
  )
}

export default Display
