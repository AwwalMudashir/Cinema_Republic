import React from 'react'
import './App.css'
import Navbar from './components/Navbar'
import Display from './Display'
import Footer from './components/Footer'
import ScrollAnimation from './ScrollAnimation'
import { useLocation } from 'react-router-dom'
import { TICKETING_ADMIN_ENABLED } from './config/features'

function App() {
  const pathname = useLocation().pathname;
  const isAdmin = TICKETING_ADMIN_ENABLED && pathname.startsWith('/admin');

  return (
    <div>
      {!isAdmin && <Navbar />}
      {!isAdmin && <ScrollAnimation />}
      <Display />
      {!isAdmin && <Footer />}
    </div>
  )
}

export default App
