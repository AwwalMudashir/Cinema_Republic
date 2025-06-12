import React from 'react'
import { Route, Routes } from 'react-router-dom'
import Home from './pages/Home'
import About from './pages/About'
import Contact from './pages/Contact'
import Events from './pages/Events'
import Partnership from './pages/Partnership'

const Display = () => {
  return (
    <Routes>
      <Route path='/' element={<Home />} />
      <Route path='/about-us' element={<About />} />
      <Route path='/contact' element={<Contact />} />
      <Route path='/events' element={<Events />} />
      <Route path='/partnership' element={<Partnership />} />
    </Routes>
  )
}

export default Display
