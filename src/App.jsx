import React from 'react'
import { useState } from 'react'
import './App.css'
import Navbar from './components/Navbar'
import Display from './Display'
import Footer from './components/Footer'
import ScrollAnimation from './ScrollAnimation'

function App() {

  return (
    <div>

      <Navbar />
      <ScrollAnimation />
      <Display />
      <Footer />
    </div>
  )
}

export default App
