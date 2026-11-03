import React from 'react';
import { HeroSection } from '../components/home/HeroSection.tsx';
import { FeaturedListingsSection } from '../components/home/FeaturedListingsSection.tsx';
import { CostEstimatorSection } from '../components/home/CostEstimatorSection.tsx';
import { NeighborhoodsSection } from '../components/home/NeighborhoodsSection.tsx';

export const HomePage: React.FC = () => (
  <>
    <HeroSection />
    <FeaturedListingsSection />
    <CostEstimatorSection />
    <NeighborhoodsSection />
  </>
);
