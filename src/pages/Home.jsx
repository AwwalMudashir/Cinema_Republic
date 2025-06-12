import React from 'react'
import HeroSection from '../components/HeroSection'
import AboutCinema57 from '../components/AboutCinema57'
import EventTypes from '../components/EventTypes'
import SilentVsTraditional from '../components/SilentVsTraditional'
import CinemaScreens from '../components/CinemaScreens'
import WhyCinema57 from '../components/WhyCinema57'
import EventFrequencyOptions from '../components/EventFrequencyOptions'

const Home = () => {
  return (
    <div>
      <HeroSection />
      <AboutCinema57 />
      <EventTypes />
      <SilentVsTraditional />
      <CinemaScreens />
      <WhyCinema57 />
      <EventFrequencyOptions />
    </div>
  )
}

export default Home
