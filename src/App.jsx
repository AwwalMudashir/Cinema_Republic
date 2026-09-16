import React from 'react'
import './App.css'
import Navbar from './components/Navbar'
import Display from './Display'
import Footer from './components/Footer'
import ScrollAnimation from './ScrollAnimation'
import { useLocation } from 'react-router-dom'

function App() {
  const isAdmin = useLocation().pathname.startsWith('/admin');

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
