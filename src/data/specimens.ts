import type { DomainProfile, SampleSpecimen, ToleranceStandard } from '../types/inspection';

export const DOMAIN_PROFILES: Array<{
  id: DomainProfile;
  label: string;
  focus: string;
}> = [
  {
    id: 'manufacturing',
    label: 'Manufacturing & CNC',
    focus: 'Surface scratches, machining burrs, pitting, bore concentricity, and anodized finish wear.',
  },
  {
    id: 'logistics',
    label: 'Logistics & Packaging',
    focus: 'Crushed corners, carton compression, torn packing seals, moisture staining, and shipping label legibility.',
  },
  {
    id: 'automotive',
    label: 'Automotive Exterior',
    focus: 'Panel dents, clearcoat scuffs, zebra-line reflection distortion, paint chips, and edge alignment.',
  },
  {
    id: 'electronics',
    label: 'Electronics & PCB',
    focus: 'Solder bridges, cold joints, component skew, missing SMD parts, lifted pads, and thermal discoloration.',
  },
  {
    id: 'infrastructure',
    label: 'Infrastructure & Weld',
    focus: 'Structural cracks, spalling, weld porosity, rust oxidation, and protective coating delamination.',
  },
];

export const TOLERANCE_STANDARDS: Array<{
  id: ToleranceStandard;
  label: string;
  threshold: number;
  description: string;
}> = [
  {
    id: 'strict',
    label: 'Strict (ISO-9001)',
    threshold: 90,
    description: 'Zero-defect threshold; minor surface wear flags conditional hold.',
  },
  {
    id: 'standard',
    label: 'Standard Commercial',
    threshold: 80,
    description: 'Balanced industrial QA; structural or major defects fail.',
  },
  {
    id: 'triage',
    label: 'Field Triage',
    threshold: 65,
    description: 'Rapid intake screening; flags critical damage and safety risks.',
  },
];

export const SAMPLE_SPECIMENS: SampleSpecimen[] = [
  {
    id: 'spec-cnc-flange',
    title: 'CNC Aluminum Flange (741-B-001)',
    batchId: 'LOT-2311-CNC',
    domainProfile: 'manufacturing',
    imageUrl: '/src/assets/images/specimen_cnc_flange_1795334804758.jpg',
    description: 'Machined turbine flange showing diagonal face scoring and rim edge burrs.',
  },
  {
    id: 'spec-freight-parcel',
    title: 'Outbound Freight Carton (FX-904)',
    batchId: 'SHIP-2026-089',
    domainProfile: 'logistics',
    imageUrl: '/src/assets/images/specimen_freight_box_1795334804125.jpg',
    description: 'Corrugated parcel on conveyor exhibiting front corner crush and seal tear.',
  },
  {
    id: 'spec-auto-door',
    title: 'Silver Body Panel (EV-DR-204)',
    batchId: 'LINE-B-042',
    domainProfile: 'automotive',
    imageUrl: '/src/assets/images/specimen_auto_panel_1795334805980.jpg',
    description: 'Painted door skin under zebra light tunnel revealing center dent and scuff.',
  },
  {
    id: 'spec-pcb-ctrl',
    title: 'Controller PCB Assembly (STM32-REV4)',
    batchId: 'SMT-2026-118',
    domainProfile: 'electronics',
    imageUrl: '/src/assets/images/specimen_pcb_board_1795334805077.jpg',
    description: 'Green solder-mask control board inspected for placement and solder integrity.',
  },
];
