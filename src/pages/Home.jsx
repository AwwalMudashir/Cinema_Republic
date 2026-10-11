import React, { lazy, Suspense } from 'react'
import HeroSection from '../components/HeroSection'
import AboutCinema57 from '../components/AboutCinema57'
import EventTypes from '../components/EventTypes'
import SilentVsTraditional from '../components/SilentVsTraditional'
import CinemaScreens from '../components/CinemaScreens'
import WhyCinema57 from '../components/WhyCinema57'
import EventFrequencyOptions from '../components/EventFrequencyOptions'
import HyperViewFeature from '../components/HyperViewFeature'
import { PUBLIC_TICKETING_ENABLED } from '../config/features'

const MovieSneakPeek = lazy(() => import('../components/MovieSneakPeek'))

const Home = () => {
  return (
    <div>
      <HeroSection />
      <HyperViewFeature />
      {PUBLIC_TICKETING_ENABLED && <Suspense fallback={null}><MovieSneakPeek /></Suspense>}
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
