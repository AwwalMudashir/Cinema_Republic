import React from 'react'
import PartnershipHero from '../components/PartnershipHero'
import VisionSection from '../components/VisionSection'
import WhyPartner from '../components/WhyPartner'
import HotelBenefits from '../components/HotelBenefits'
import PartnershipCTA from '../components/PartnershipCTA'
import CurrentPartners from '../components/CurrentPartners'
import HyperViewStory from '../components/HyperViewStory'

const Partnership = () => {
  return (
    <div>
      <PartnershipHero />
      <HyperViewStory />
      <VisionSection />
      <WhyPartner />
      <HotelBenefits />
      <CurrentPartners />
      <PartnershipCTA />
    </div>
  )
}

export default Partnership
