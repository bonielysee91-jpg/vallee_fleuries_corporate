import React from 'react';
import { Outlet } from 'react-router-dom';
import { DynamicHeader } from './DynamicHeader.tsx';
import { Footer } from './Footer.tsx';
import { MobileBottomNav } from './MobileBottomNav.tsx';
import { TabletDrawer } from './TabletDrawer.tsx';
import { MobileSearchDrawer } from './MobileSearchDrawer.tsx';
import { VisitModal } from '../modals/VisitModal.tsx';
import { PaymentModal } from '../modals/PaymentModal.tsx';
import { VirtualTourModal } from '../modals/VirtualTourModal.tsx';
import { QuittanceModal } from '../modals/QuittanceModal.tsx';

/**
 * Chrome shared by every public / client route: adaptive header, footer,
 * mobile bottom bar, tablet drawer and the transactional modals.
 */
export const PublicLayout: React.FC = () => (
  <div className="min-h-screen flex flex-col bg-[#F8FAFC] text-[#0F172A] selection:bg-emerald-700 selection:text-white font-sans antialiased pb-20 md:pb-0">
    <DynamicHeader />

    <main className="flex-1">
      <Outlet />
    </main>

    <Footer />

    <MobileBottomNav />
    <TabletDrawer />
    <MobileSearchDrawer />

    <VisitModal />
    <PaymentModal />
    <VirtualTourModal />
    <QuittanceModal />
  </div>
);
