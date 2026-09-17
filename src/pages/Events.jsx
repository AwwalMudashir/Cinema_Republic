import React from 'react'
import EventsHero from '../components/EventsHero'
import EventsGallery from '../components/EventsGallery'
import HyperViewFilms from '../components/HyperViewFilms'

const Events = () => {
  return (
    <div>
      <EventsHero />
      <HyperViewFilms />
      <EventsGallery />
    </div>
  )
}

export default Events
