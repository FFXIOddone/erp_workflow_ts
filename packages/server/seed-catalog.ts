/**
 * Seed Script: Populate PriceBook with Wilde Signs Product Catalog
 * 
 * Generic product types with artwork options for the self-service quote builder.
 * Products are physical product types (e.g. "Signicade Insert"); artwork choices
 * are stored as JSON arrays on each product.
 * 
 * Run: npx tsx seed-catalog.ts
 */

import { PrismaClient, Prisma, PricingUnit } from '@prisma/client';

const prisma = new PrismaClient();

// ============================================================
// CATEGORY DEFINITIONS (hierarchical)
// ============================================================
interface CategoryDef {
  name: string;
  description: string;
  icon: string;
  color: string;
  sortOrder: number;
  children?: Omit<CategoryDef, 'children'>[];
}

const CATEGORIES: CategoryDef[] = [
  {
    name: 'Signs & Inserts',
    description: 'Stock and custom signs for A-frames, poster frames, and more. Durable substrates with full-color printing.',
    icon: '🪧',
    color: '#3B82F6',
    sortOrder: 1,
    children: [
      { name: 'Signicade Inserts', description: 'Full-color inserts for Deluxe Signicade and Simpo Sign II A-frame signs. Double-sided available.', icon: '📋', color: '#60A5FA', sortOrder: 1 },
      { name: 'Poster Frame Inserts', description: 'Inserts for Classic Curb Frames, Sidewalk Springers, and Wind Sign frames.', icon: '🖼️', color: '#60A5FA', sortOrder: 2 },
      { name: 'Changeable Price Signs', description: 'Spiral-bound flip signs for milk, eggs, and other products with changeable number pads.', icon: '🔢', color: '#60A5FA', sortOrder: 3 },
      { name: 'Yard Signs', description: 'Corrugated plastic yard signs with H-wire step stakes. Great for hiring, events, and promotions.', icon: '🏡', color: '#60A5FA', sortOrder: 4 },
      { name: 'Window & Door Signs', description: 'Styrene posters and vinyl decals for windows and doors. Now Hiring, Hours, and more.', icon: '🪟', color: '#60A5FA', sortOrder: 5 },
      { name: 'Seasonal Signage', description: 'Holiday and seasonal promotional signs — Black Friday, 4th of July, and more.', icon: '🎄', color: '#60A5FA', sortOrder: 6 },
    ],
  },
  {
    name: 'Banners',
    description: 'Indoor and outdoor vinyl and mesh banners. Hemmed edges with grommets. Custom sizes available.',
    icon: '🎌',
    color: '#8B5CF6',
    sortOrder: 2,
    children: [
      { name: 'Vinyl Banners', description: 'Full-color printed 13oz vinyl banners with hem and grommets. Any size, any quantity.', icon: '🏳️', color: '#A78BFA', sortOrder: 1 },
      { name: 'Mesh Banners', description: 'Perforated mesh banners ideal for windy outdoor locations. Allows airflow while maintaining visibility.', icon: '🌬️', color: '#A78BFA', sortOrder: 2 },
      { name: 'Retractable Banners', description: 'Pull-up retractable banner stands for trade shows, lobbies, and events. Easy setup and transport.', icon: '📐', color: '#A78BFA', sortOrder: 3 },
      { name: 'Pole Banners', description: 'Double-sided pole banners with hardware kits for light pole mounting.', icon: '🏗️', color: '#A78BFA', sortOrder: 4 },
    ],
  },
  {
    name: 'Decals & Stickers',
    description: 'Weatherproof vinyl decals for gas pumps, windows, floors, and more. UV-protected full-color printing.',
    icon: '🏷️',
    color: '#10B981',
    sortOrder: 3,
    children: [
      { name: 'Gas Pump Decals', description: 'Informational and branding decals for gas pump islands. Multiple sizes available.', icon: '⛽', color: '#34D399', sortOrder: 1 },
      { name: 'Octane Rating Decals', description: 'Fuel grade octane rating decals for gas pumps. Federal and state compliant.', icon: '🔋', color: '#34D399', sortOrder: 2 },
      { name: 'Pump Number Decals', description: 'Large pump identification number decals in various colors and sizes.', icon: '🔢', color: '#34D399', sortOrder: 3 },
      { name: 'Michigan Mandatory Decals', description: 'Michigan Quality Standards fuel decals. Available on black or white backers.', icon: '📜', color: '#34D399', sortOrder: 4 },
      { name: 'Floor Graphics', description: 'Durable floor graphic decals for social distancing, wayfinding, and promotions.', icon: '🏠', color: '#34D399', sortOrder: 5 },
      { name: 'Custom Decals', description: 'Custom-designed vinyl decals in any shape, size, and finish. Die-cut and kiss-cut available.', icon: '✂️', color: '#34D399', sortOrder: 6 },
    ],
  },
  {
    name: 'Frames & Stands',
    description: 'A-frame signs, poster frames, curb signs, and display stands to showcase your messaging.',
    icon: '🗂️',
    color: '#F59E0B',
    sortOrder: 4,
    children: [
      { name: 'A-Frame Signs', description: 'Deluxe Signicade and Simpo Sign II portable A-frame sign stands.', icon: '⚠️', color: '#FBBF24', sortOrder: 1 },
      { name: 'Poster Frames', description: 'Classic Curb Frames, snap lock poster frames, and wall-mount options.', icon: '🖼️', color: '#FBBF24', sortOrder: 2 },
      { name: 'Sidewalk Signs', description: 'Wind-resistant sidewalk springer signs and curb sign frames.', icon: '🚶', color: '#FBBF24', sortOrder: 3 },
      { name: 'Banner Stands', description: 'X-banner stands, retractable stands, and tabletop display stands.', icon: '📱', color: '#FBBF24', sortOrder: 4 },
    ],
  },
  {
    name: 'Vehicle Graphics',
    description: 'Full and partial vehicle wraps, fleet graphics, magnetic signs, and window perf for cars, trucks, and vans.',
    icon: '🚗',
    color: '#EF4444',
    sortOrder: 5,
    children: [
      { name: 'Full Vehicle Wraps', description: 'Complete vehicle wraps with premium cast vinyl. Transform any vehicle into a mobile billboard.', icon: '🚐', color: '#F87171', sortOrder: 1 },
      { name: 'Partial Wraps', description: 'Strategic partial wraps covering key panels for maximum impact at lower cost.', icon: '🚙', color: '#F87171', sortOrder: 2 },
      { name: 'Fleet Graphics', description: 'Consistent branding across your entire fleet. Volume discounts available.', icon: '🚚', color: '#F87171', sortOrder: 3 },
      { name: 'Magnetic Signs', description: 'Removable magnetic vehicle signs. Great for dual-use personal/business vehicles.', icon: '🧲', color: '#F87171', sortOrder: 4 },
    ],
  },
  {
    name: 'Large Format Printing',
    description: 'Wide-format printing on various substrates — posters, wall murals, window graphics, POP displays.',
    icon: '🖨️',
    color: '#EC4899',
    sortOrder: 6,
    children: [
      { name: 'Posters & Prints', description: 'Large format posters on paper, photo paper, or mounted substrates.', icon: '📰', color: '#F472B6', sortOrder: 1 },
      { name: 'Wall Graphics', description: 'Custom wall murals and graphics printed on adhesive or fabric media.', icon: '🖼️', color: '#F472B6', sortOrder: 2 },
      { name: 'Window Graphics', description: 'Window clings, perforated window film, and frosted vinyl for storefronts.', icon: '🪟', color: '#F472B6', sortOrder: 3 },
      { name: 'Backlit & Translite', description: 'Translucent prints for backlit displays, light boxes, and menu boards.', icon: '💡', color: '#F472B6', sortOrder: 4 },
    ],
  },
  {
    name: 'Service Centers',
    description: 'Customer convenience stations for gas stations and retail — windshield cleaner stations with custom sign inserts.',
    icon: '🧹',
    color: '#6366F1',
    sortOrder: 7,
  },
  {
    name: 'Hardware & Accessories',
    description: 'Mounting hardware, suction cups, step stakes, zip ties, and other sign installation accessories.',
    icon: '🔧',
    color: '#78716C',
    sortOrder: 8,
    children: [
      { name: 'Protective Barriers', description: 'Safebloc™ polycarbonate protective barriers — desk mount, counter mount, hanging, and full wall.', icon: '🛡️', color: '#A8A29E', sortOrder: 1 },
      { name: 'Mounting Hardware', description: 'Sign brackets, standoffs, suction cups, and screws for sign installation.', icon: '🔩', color: '#A8A29E', sortOrder: 2 },
      { name: 'Stakes & Stands', description: 'H-wire step stakes, spider stakes, and ground-mount sign holders.', icon: '📌', color: '#A8A29E', sortOrder: 3 },
    ],
  },
  {
    name: 'Trade Show & Events',
    description: 'Portable displays, backdrops, table covers, and event signage for trade shows and corporate events.',
    icon: '🎪',
    color: '#14B8A6',
    sortOrder: 9,
    children: [
      { name: 'Pop-Up Displays', description: 'Portable pop-up fabric and graphic displays for trade show booths.', icon: '🏕️', color: '#2DD4BF', sortOrder: 1 },
      { name: 'Table Covers & Runners', description: 'Custom-printed table throws and runners for branded booth presentations.', icon: '🎯', color: '#2DD4BF', sortOrder: 2 },
      { name: 'Event Signage', description: 'Directional signs, welcome signs, sponsor boards, and step-and-repeat backdrops.', icon: '🎫', color: '#2DD4BF', sortOrder: 3 },
    ],
  },
];

// ============================================================
// ARTWORK OPTION TYPE
// ============================================================
interface ArtworkOption {
  id: string;
  name: string;
  description?: string;
  thumbnailUrl?: string;
}

// ============================================================
// PRODUCT DEFINITIONS — Generic product types with artwork options
// ============================================================
interface ProductDef {
  sku: string;
  name: string;
  description: string;
  categoryPath: string;
  basePrice: number;
  costPrice?: number;
  pricingUnit: PricingUnit;
  minQuantity: number;
  estimatedLeadDays: number;
  tags: string[];
  pricingTiers?: Array<{ minQty: number; maxQty?: number; price?: number; discountPercent?: number }>;
  artworkOptions?: ArtworkOption[];
}

const PRODUCTS: ProductDef[] = [
  // ============================================================
  // SIGNS & INSERTS
  // ============================================================

  // -- Signicade Inserts (was 14 products, now 1 with artwork choices) --
  {
    sku: 'WSW-SIGNICADE',
    name: 'Signicade Insert',
    description: 'Full color .040 corrugated plastic insert for Deluxe Signicade (24"x36") or Simpo Sign II (22"x28"). Single or double sided.',
    categoryPath: 'Signs & Inserts > Signicade Inserts',
    basePrice: 24.99,
    costPrice: 8.50,
    pricingUnit: PricingUnit.EACH,
    minQuantity: 1,
    estimatedLeadDays: 5,
    tags: ['signicade', 'a-frame', 'insert', 'american-made'],
    pricingTiers: [
      { minQty: 1, maxQty: 4, price: 24.99 },
      { minQty: 5, maxQty: 9, price: 22.99 },
      { minQty: 10, price: 19.99 },
    ],
    artworkOptions: [
      { id: 'sig-atm-here', name: 'ATM Here', description: 'Let customers know you have an ATM' },
      { id: 'sig-atm-inside', name: 'ATM Inside', description: 'ATM inside location sign' },
      { id: 'sig-no-parking-zone', name: 'No Parking Zone', description: 'No Parking Zone warning' },
      { id: 'sig-no-parking', name: 'No Parking', description: 'No Parking sign' },
      { id: 'sig-ice-sold-here', name: 'Ice Sold Here', description: 'Advertise ice for sale' },
      { id: 'sig-now-hiring', name: 'Now Hiring', description: 'Drive walk-in applicants' },
      { id: 'sig-car-wash', name: 'Car Wash', description: 'Promote car wash services' },
      { id: 'sig-try-our-car-wash', name: 'Try Our Car Wash', description: 'Alternative car wash design' },
      { id: 'sig-monster-sale', name: 'Monster on Sale', description: 'Monster Energy drink promo' },
      { id: 'sig-cigarettes', name: 'Cigarettes Lowest Prices', description: 'Tobacco pricing sign' },
      { id: 'sig-black-friday', name: 'Black Friday Sale', description: 'Black Friday promotional' },
      { id: 'sig-4th-of-july', name: '4th of July Sale', description: '4th of July promotional' },
      { id: 'sig-sale', name: 'Sale', description: 'General purpose sale sign' },
    ],
  },

  // -- Poster Frame Inserts (was 5, now 1) --
  {
    sku: 'WPF-INSERT',
    name: 'Poster Frame Insert',
    description: '.040 coated styrene insert for Classic Curb Frame, Wind Sign Sidewalk Springer, or snap lock poster frames.',
    categoryPath: 'Signs & Inserts > Poster Frame Inserts',
    basePrice: 24.99,
    costPrice: 8.50,
    pricingUnit: PricingUnit.EACH,
    minQuantity: 1,
    estimatedLeadDays: 5,
    tags: ['poster-frame', 'insert'],
    artworkOptions: [
      { id: 'pf-sale', name: 'Sale', description: 'General purpose sale design' },
      { id: 'pf-4th-of-july', name: '4th of July Sale', description: '4th of July themed design' },
      { id: 'pf-red-bull', name: 'Red Bull on Sale', description: 'Red Bull promotional' },
      { id: 'pf-car-wash', name: 'We Have A Car Wash', description: 'Car wash promotional' },
    ],
  },

  // -- Changeable Price Signs (was 3, now 1) --
  {
    sku: 'WFLIP-PRICE',
    name: 'Changeable Price Sign',
    description: 'Spiral-bound changeable price flip sign with number and cent pads. Available in 15" and 20" sizes.',
    categoryPath: 'Signs & Inserts > Changeable Price Signs',
    basePrice: 24.98,
    costPrice: 12.00,
    pricingUnit: PricingUnit.EACH,
    minQuantity: 1,
    estimatedLeadDays: 5,
    tags: ['changeable-price', 'flip-sign'],
    pricingTiers: [
      { minQty: 1, maxQty: 4, price: 24.98 },
      { minQty: 5, maxQty: 9, price: 22.00 },
      { minQty: 10, price: 19.99 },
    ],
    artworkOptions: [
      { id: 'flip-milk', name: 'Milk Gallon', description: 'Milk gallon pricing sign' },
      { id: 'flip-eggs', name: 'Dozen Eggs', description: 'Egg pricing sign' },
      { id: 'flip-custom', name: 'Custom Product', description: 'Any product, any wording' },
    ],
  },

  // -- Yard Signs (was 2, now 1) --
  {
    sku: 'WYS-YARD',
    name: 'Yard Sign (18"x24")',
    description: '18"x24" corrugated plastic yard sign with H-wire step stake. Full color, weather-resistant. Single or double sided.',
    categoryPath: 'Signs & Inserts > Yard Signs',
    basePrice: 13.90,
    costPrice: 5.00,
    pricingUnit: PricingUnit.EACH,
    minQuantity: 1,
    estimatedLeadDays: 3,
    tags: ['yard-sign', 'coroplast'],
    pricingTiers: [
      { minQty: 1, maxQty: 9, price: 13.90 },
      { minQty: 10, maxQty: 24, price: 11.50 },
      { minQty: 25, maxQty: 49, price: 9.99 },
      { minQty: 50, price: 7.99 },
    ],
    artworkOptions: [
      { id: 'ys-hiring', name: 'Now Hiring', description: 'Now Hiring yard sign' },
      { id: 'ys-open', name: 'Now Open', description: 'Grand opening / now open sign' },
      { id: 'ys-for-sale', name: 'For Sale', description: 'For sale property sign' },
    ],
  },

  // -- Window & Door Signs (was 2, now 1) --
  {
    sku: 'WWIN-SIGN',
    name: 'Window / Door Sign',
    description: 'Low-tack vinyl decal or styrene poster for windows and doors. Easy application and removal.',
    categoryPath: 'Signs & Inserts > Window & Door Signs',
    basePrice: 19.99,
    costPrice: 4.00,
    pricingUnit: PricingUnit.EACH,
    minQuantity: 1,
    estimatedLeadDays: 3,
    tags: ['window', 'door', 'sign'],
    pricingTiers: [
      { minQty: 1, maxQty: 4, price: 19.99 },
      { minQty: 5, maxQty: 9, price: 12.99 },
      { minQty: 10, maxQty: 24, price: 9.99 },
      { minQty: 25, price: 6.99 },
    ],
    artworkOptions: [
      { id: 'win-hours', name: 'Store Hours', description: 'Temporary store hours decal' },
      { id: 'win-hiring', name: 'Now Hiring', description: 'Now Hiring window poster' },
      { id: 'win-open', name: 'Open / Closed', description: 'Open/Closed sign' },
    ],
  },

  // -- Seasonal Signage --
  {
    sku: 'WSEA-POSTER',
    name: 'Seasonal Window Poster (30"x30")',
    description: '30"x30" .040 Styrene window poster with suction cups. Single sided. Bold seasonal designs.',
    categoryPath: 'Signs & Inserts > Seasonal Signage',
    basePrice: 49.99,
    costPrice: 15.00,
    pricingUnit: PricingUnit.EACH,
    minQuantity: 1,
    estimatedLeadDays: 5,
    tags: ['seasonal', 'window', 'poster'],
    artworkOptions: [
      { id: 'sea-bf-3d', name: 'Black Friday "3-D"', description: '3D-effect Black Friday design' },
      { id: 'sea-bf-redtag', name: 'Black Friday "Red Tag"', description: 'Classic red tag design' },
      { id: 'sea-bf-bw', name: 'Black Friday "Blk N White"', description: 'Bold black and white design' },
      { id: 'sea-july4', name: '4th of July', description: 'Independence Day celebration' },
    ],
  },
  {
    sku: 'WSEA-BANNER',
    name: 'Seasonal Banner (8\'x3\')',
    description: '8\'x3\' vinyl banner with grommets. Seasonal promotional designs.',
    categoryPath: 'Signs & Inserts > Seasonal Signage',
    basePrice: 99.99,
    costPrice: 35.00,
    pricingUnit: PricingUnit.EACH,
    minQuantity: 1,
    estimatedLeadDays: 5,
    tags: ['seasonal', 'banner'],
    artworkOptions: [
      { id: 'seab-bf-3d', name: 'Black Friday "3-D"', description: 'Black Friday 3-D banner design' },
      { id: 'seab-bf-sale', name: 'Black Friday Sale', description: 'Black Friday sale banner' },
      { id: 'seab-july4', name: '4th of July', description: '4th of July banner' },
    ],
  },

  // ============================================================
  // BANNERS
  // ============================================================
  {
    sku: 'WBAN-VINYL',
    name: 'Vinyl Banner',
    description: '13oz vinyl banner with hem and grommets. Full-color printing, any size. Outdoor durable, UV resistant.',
    categoryPath: 'Banners > Vinyl Banners',
    basePrice: 4.50,
    costPrice: 1.80,
    pricingUnit: PricingUnit.SQFT,
    minQuantity: 1,
    estimatedLeadDays: 3,
    tags: ['banner', 'vinyl', 'outdoor', 'custom'],
    pricingTiers: [
      { minQty: 1, maxQty: 4, price: 4.50 },
      { minQty: 5, maxQty: 9, price: 3.99 },
      { minQty: 10, price: 3.49 },
    ],
    artworkOptions: [
      { id: 'ban-grand-opening', name: 'Grand Opening', description: 'Grand opening celebration banner' },
      { id: 'ban-sale', name: 'Sale / Clearance', description: 'General sale banner' },
      { id: 'ban-now-open', name: 'Now Open', description: 'Now open announcement' },
    ],
  },
  {
    sku: 'WBAN-MESH',
    name: 'Mesh Banner',
    description: 'Perforated mesh banner ideal for windy locations. Full-color printing with wind resistance.',
    categoryPath: 'Banners > Mesh Banners',
    basePrice: 5.50,
    costPrice: 2.50,
    pricingUnit: PricingUnit.SQFT,
    minQuantity: 1,
    estimatedLeadDays: 5,
    tags: ['banner', 'mesh', 'outdoor', 'wind-resistant'],
  },
  {
    sku: 'WBAN-RETRACT-SM',
    name: 'Retractable Banner Stand (33"x81")',
    description: 'Standard retractable banner stand with full-color printed banner. Includes carrying case.',
    categoryPath: 'Banners > Retractable Banners',
    basePrice: 89.99,
    costPrice: 35.00,
    pricingUnit: PricingUnit.EACH,
    minQuantity: 1,
    estimatedLeadDays: 5,
    tags: ['banner', 'retractable', 'trade-show', 'portable'],
    pricingTiers: [
      { minQty: 1, maxQty: 2, price: 89.99 },
      { minQty: 3, maxQty: 4, price: 79.99 },
      { minQty: 5, price: 69.99 },
    ],
  },
  {
    sku: 'WBAN-RETRACT-LG',
    name: 'Retractable Banner Stand (47"x81")',
    description: 'Wide retractable banner stand with full-color printed banner. Premium aluminum base with carrying case.',
    categoryPath: 'Banners > Retractable Banners',
    basePrice: 129.99,
    costPrice: 50.00,
    pricingUnit: PricingUnit.EACH,
    minQuantity: 1,
    estimatedLeadDays: 5,
    tags: ['banner', 'retractable', 'trade-show', 'wide'],
  },
  {
    sku: 'WBAN-POLE',
    name: 'Pole Banner (Double-Sided)',
    description: 'Custom double-sided pole banner with mounting hardware kit. Various sizes available.',
    categoryPath: 'Banners > Pole Banners',
    basePrice: 75.00,
    costPrice: 30.00,
    pricingUnit: PricingUnit.EACH,
    minQuantity: 2,
    estimatedLeadDays: 7,
    tags: ['banner', 'pole', 'outdoor', 'double-sided'],
    pricingTiers: [
      { minQty: 2, maxQty: 9, price: 75.00 },
      { minQty: 10, maxQty: 24, price: 65.00 },
      { minQty: 25, price: 55.00 },
    ],
  },

  // ============================================================
  // DECALS & STICKERS
  // ============================================================

  // -- Gas Pump Decals (consolidated by size) --
  {
    sku: 'WPD-5X3',
    name: 'Pump Decal (5"x3")',
    description: 'Full-color weatherproof vinyl pump decal. UV protective coating. Permanent adhesive.',
    categoryPath: 'Decals & Stickers > Gas Pump Decals',
    basePrice: 1.99,
    costPrice: 0.40,
    pricingUnit: PricingUnit.EACH,
    minQuantity: 10,
    estimatedLeadDays: 5,
    tags: ['decal', 'pump', 'gas-station', '5x3'],
    pricingTiers: [
      { minQty: 10, maxQty: 24, price: 1.99 },
      { minQty: 25, maxQty: 49, price: 1.49 },
      { minQty: 50, maxQty: 99, price: 1.19 },
      { minQty: 100, price: 0.89 },
    ],
    artworkOptions: [
      { id: 'pd5-credit-prepay', name: 'Credit or Prepay', description: 'All pumps credit or prepay notification' },
      { id: 'pd5-mobile-pay', name: 'Mobile Pay Accepted', description: 'Mobile payment accepted indicator' },
      { id: 'pd5-apps', name: 'Taking Applications', description: 'Now taking applications' },
    ],
  },
  {
    sku: 'WPD-12X4',
    name: 'Pump Decal (12"x4")',
    description: 'Wide-format full-color weatherproof pump decal. Perfect for branding at the pump.',
    categoryPath: 'Decals & Stickers > Gas Pump Decals',
    basePrice: 3.29,
    costPrice: 0.80,
    pricingUnit: PricingUnit.EACH,
    minQuantity: 10,
    estimatedLeadDays: 5,
    tags: ['decal', 'pump', 'gas-station', '12x4'],
    pricingTiers: [
      { minQty: 10, maxQty: 24, price: 3.29 },
      { minQty: 25, maxQty: 49, price: 2.49 },
      { minQty: 50, maxQty: 99, price: 1.99 },
      { minQty: 100, price: 1.49 },
    ],
    artworkOptions: [
      { id: 'pd12-branding', name: 'Store Branding', description: 'Your logo and branding at the pump' },
    ],
  },
  {
    sku: 'WPD-5X8',
    name: 'Pump Decal (5"x8")',
    description: 'Full-color weatherproof vinyl pump decal. Large format for high visibility.',
    categoryPath: 'Decals & Stickers > Gas Pump Decals',
    basePrice: 1.99,
    costPrice: 0.50,
    pricingUnit: PricingUnit.EACH,
    minQuantity: 5,
    estimatedLeadDays: 3,
    tags: ['decal', 'pump', 'gas-station', '5x8'],
    artworkOptions: [
      { id: 'pd8-apps', name: 'Taking Applications', description: 'Recruitment decal for gas stations' },
    ],
  },

  // -- Octane Rating Decals --
  {
    sku: 'WOCT-RATING',
    name: 'Octane Rating Decal',
    description: 'Standard FTC-compliant octane rating decal for fuel pumps. Federal and state compliant format.',
    categoryPath: 'Decals & Stickers > Octane Rating Decals',
    basePrice: 1.49,
    costPrice: 0.30,
    pricingUnit: PricingUnit.EACH,
    minQuantity: 10,
    estimatedLeadDays: 3,
    tags: ['octane', 'fuel', 'pump', 'rating'],
    pricingTiers: [
      { minQty: 10, maxQty: 24, price: 1.49 },
      { minQty: 25, maxQty: 49, price: 1.19 },
      { minQty: 50, price: 0.89 },
    ],
    artworkOptions: [
      { id: 'oct-87', name: '87 Regular', description: 'Regular octane 87' },
      { id: 'oct-89', name: '89 Mid-Grade', description: 'Mid-grade octane 89' },
      { id: 'oct-91', name: '91 Premium', description: 'Premium octane 91' },
      { id: 'oct-93', name: '93 Super Premium', description: 'Super premium octane 93' },
    ],
  },

  // -- Pump Number Decals --
  {
    sku: 'WPN-3X4',
    name: 'Pump Number Decal Pack (3"x4")',
    description: 'Set of pump identification number decals. Clear with colored numbers. Multiple color options.',
    categoryPath: 'Decals & Stickers > Pump Number Decals',
    basePrice: 29.99,
    costPrice: 8.00,
    pricingUnit: PricingUnit.SET,
    minQuantity: 1,
    estimatedLeadDays: 3,
    tags: ['pump-numbers', 'decal', 'gas-station'],
    pricingTiers: [
      { minQty: 1, maxQty: 2, price: 29.99 },
      { minQty: 3, maxQty: 4, price: 24.99 },
      { minQty: 5, price: 19.99 },
    ],
  },
  {
    sku: 'WPN-5X8',
    name: 'Pump Number Decal Pack (5"x8")',
    description: 'Large pump identification number decals. High visibility for customer convenience.',
    categoryPath: 'Decals & Stickers > Pump Number Decals',
    basePrice: 49.99,
    costPrice: 12.00,
    pricingUnit: PricingUnit.SET,
    minQuantity: 1,
    estimatedLeadDays: 3,
    tags: ['pump-numbers', 'decal', 'gas-station', 'large'],
  },

  // -- Michigan Mandatory Decals --
  {
    sku: 'WMI-FUEL',
    name: 'Michigan Mandatory Fuel Decal',
    description: 'Michigan Quality Standards fuel decal. Permanent vinyl with UV protection. Available on black or white backer.',
    categoryPath: 'Decals & Stickers > Michigan Mandatory Decals',
    basePrice: 12.49,
    costPrice: 3.00,
    pricingUnit: PricingUnit.PACK,
    minQuantity: 10,
    estimatedLeadDays: 5,
    tags: ['michigan', 'mandatory', 'fuel'],
    pricingTiers: [
      { minQty: 10, maxQty: 19, price: 12.49 },
      { minQty: 20, maxQty: 29, price: 10.99 },
      { minQty: 30, price: 9.49 },
    ],
    artworkOptions: [
      { id: 'mi-90-4x3', name: 'Premium 90 (4"x3")', description: 'Premium 90 fuel rating' },
      { id: 'mi-93-4x4', name: 'Premium 93 10% Ethanol (4"x4")', description: 'Premium 93 with ethanol' },
      { id: 'mi-94-4x3', name: 'Premium 94 (4"x3")', description: 'Premium 94 fuel rating' },
      { id: 'mi-multi-6x4', name: 'Multi Octane (6.5"x4.5")', description: 'Multi-grade dispensers — $26.99/pack' },
    ],
  },

  // -- Floor Graphics --
  {
    sku: 'WFLR-GRAPHIC',
    name: 'Floor Graphic',
    description: 'Durable floor graphic decals with anti-slip laminate. Indoor/outdoor options. Die-cut to any shape.',
    categoryPath: 'Decals & Stickers > Floor Graphics',
    basePrice: 8.99,
    costPrice: 3.00,
    pricingUnit: PricingUnit.SQFT,
    minQuantity: 1,
    estimatedLeadDays: 5,
    tags: ['floor-graphic'],
    artworkOptions: [
      { id: 'flr-6ft', name: 'Keep 6ft Apart', description: '12" circle social distancing' },
      { id: 'flr-directional', name: 'Directional Arrow', description: 'Wayfinding floor arrow' },
    ],
  },

  // -- Custom Decals --
  {
    sku: 'WDEC-SM',
    name: 'Custom Die-Cut Decal (up to 5")',
    description: 'Custom die-cut vinyl decal up to 5" wide/tall. Permanent outdoor vinyl with UV protection.',
    categoryPath: 'Decals & Stickers > Custom Decals',
    basePrice: 2.99,
    costPrice: 0.50,
    pricingUnit: PricingUnit.EACH,
    minQuantity: 10,
    estimatedLeadDays: 5,
    tags: ['decal', 'custom', 'die-cut'],
    pricingTiers: [
      { minQty: 10, maxQty: 49, price: 2.99 },
      { minQty: 50, maxQty: 99, price: 2.29 },
      { minQty: 100, maxQty: 249, price: 1.79 },
      { minQty: 250, price: 1.29 },
    ],
  },
  {
    sku: 'WDEC-LG',
    name: 'Custom Die-Cut Decal (6"–12")',
    description: 'Custom die-cut vinyl decal 6"–12" wide/tall. Premium outdoor vinyl.',
    categoryPath: 'Decals & Stickers > Custom Decals',
    basePrice: 5.99,
    costPrice: 1.20,
    pricingUnit: PricingUnit.EACH,
    minQuantity: 5,
    estimatedLeadDays: 5,
    tags: ['decal', 'custom', 'die-cut', 'large'],
  },
  {
    sku: 'WDEC-BUMPER',
    name: 'Custom Bumper Sticker',
    description: 'Full-color custom bumper stickers. Permanent or removable adhesive options.',
    categoryPath: 'Decals & Stickers > Custom Decals',
    basePrice: 1.99,
    costPrice: 0.35,
    pricingUnit: PricingUnit.EACH,
    minQuantity: 25,
    estimatedLeadDays: 5,
    tags: ['sticker', 'bumper', 'custom'],
    pricingTiers: [
      { minQty: 25, maxQty: 49, price: 1.99 },
      { minQty: 50, maxQty: 99, price: 1.49 },
      { minQty: 100, maxQty: 249, price: 0.99 },
      { minQty: 250, price: 0.69 },
    ],
  },

  // ============================================================
  // FRAMES & STANDS
  // ============================================================
  {
    sku: 'WFRM-SIGNICADE',
    name: 'Deluxe Signicade A-Frame',
    description: 'Portable A-frame sign stand. Holds 24"x36" inserts. No tools required, folds flat for storage.',
    categoryPath: 'Frames & Stands > A-Frame Signs',
    basePrice: 99.99,
    costPrice: 55.00,
    pricingUnit: PricingUnit.EACH,
    minQuantity: 1,
    estimatedLeadDays: 5,
    tags: ['signicade', 'a-frame', 'stand'],
  },
  {
    sku: 'WFRM-SIMPO',
    name: 'Simpo Sign II A-Frame',
    description: 'Economy A-frame sign stand. Holds 22"x28" inserts. Lightweight and portable.',
    categoryPath: 'Frames & Stands > A-Frame Signs',
    basePrice: 69.99,
    costPrice: 38.00,
    pricingUnit: PricingUnit.EACH,
    minQuantity: 1,
    estimatedLeadDays: 5,
    tags: ['simpo', 'a-frame', 'stand', 'economy'],
  },
  {
    sku: 'WFRM-CURB',
    name: 'Classic Curb Sign Frame',
    description: 'Heavy-duty curb sign frame with spring-loaded base. Holds 28"x22" inserts. Wind-resistant.',
    categoryPath: 'Frames & Stands > Poster Frames',
    basePrice: 149.99,
    costPrice: 75.00,
    pricingUnit: PricingUnit.EACH,
    minQuantity: 1,
    estimatedLeadDays: 7,
    tags: ['curb-frame', 'poster-frame', 'outdoor'],
  },
  {
    sku: 'WFRM-SNAP-22',
    name: 'Snap Lock Poster Frame (22"x28")',
    description: 'Front-loading snap lock poster frame. Easy insert changes without tools.',
    categoryPath: 'Frames & Stands > Poster Frames',
    basePrice: 56.00,
    costPrice: 28.00,
    pricingUnit: PricingUnit.EACH,
    minQuantity: 1,
    estimatedLeadDays: 5,
    tags: ['snap-lock', 'poster-frame'],
  },
  {
    sku: 'WFRM-SNAP-36',
    name: 'Snap Lock Poster Frame (36"x28")',
    description: 'Large front-loading snap lock poster frame for maximum visibility.',
    categoryPath: 'Frames & Stands > Poster Frames',
    basePrice: 75.83,
    costPrice: 38.00,
    pricingUnit: PricingUnit.EACH,
    minQuantity: 1,
    estimatedLeadDays: 5,
    tags: ['snap-lock', 'poster-frame', 'large'],
  },
  {
    sku: 'WFRM-SPRINGER',
    name: 'Windmaster Sidewalk Springer',
    description: 'Spring-loaded sidewalk sign that flexes in wind. Holds 24"x36" inserts. Heavy-duty construction.',
    categoryPath: 'Frames & Stands > Sidewalk Signs',
    basePrice: 189.99,
    costPrice: 95.00,
    pricingUnit: PricingUnit.EACH,
    minQuantity: 1,
    estimatedLeadDays: 7,
    tags: ['sidewalk', 'springer', 'wind-resistant', 'windmaster'],
  },

  // ============================================================
  // VEHICLE GRAPHICS
  // ============================================================
  {
    sku: 'WVEH-FULL-WRAP',
    name: 'Full Vehicle Wrap',
    description: 'Complete vehicle wrap with premium cast vinyl and overlaminate. Design, print, and installation included.',
    categoryPath: 'Vehicle Graphics > Full Vehicle Wraps',
    basePrice: 12.00,
    costPrice: 4.50,
    pricingUnit: PricingUnit.SQFT,
    minQuantity: 1,
    estimatedLeadDays: 14,
    tags: ['vehicle', 'wrap', 'full', 'cast-vinyl'],
  },
  {
    sku: 'WVEH-PARTIAL',
    name: 'Partial Vehicle Wrap',
    description: 'Strategic partial wrap covering doors, rear, or specific panels. Great impact at a lower price point.',
    categoryPath: 'Vehicle Graphics > Partial Wraps',
    basePrice: 10.00,
    costPrice: 3.50,
    pricingUnit: PricingUnit.SQFT,
    minQuantity: 1,
    estimatedLeadDays: 10,
    tags: ['vehicle', 'wrap', 'partial'],
  },
  {
    sku: 'WVEH-FLEET',
    name: 'Fleet Vehicle Graphics',
    description: 'Consistent branding across your fleet. Cut vinyl lettering and graphics. Volume pricing available.',
    categoryPath: 'Vehicle Graphics > Fleet Graphics',
    basePrice: 8.00,
    costPrice: 2.50,
    pricingUnit: PricingUnit.SQFT,
    minQuantity: 1,
    estimatedLeadDays: 7,
    tags: ['vehicle', 'fleet', 'graphics'],
    pricingTiers: [
      { minQty: 1, maxQty: 4, price: 8.00 },
      { minQty: 5, maxQty: 9, price: 7.00 },
      { minQty: 10, price: 6.00 },
    ],
  },
  {
    sku: 'WVEH-MAG-12X24',
    name: 'Magnetic Vehicle Sign (12"x24")',
    description: 'Removable magnetic vehicle sign. Full-color printing on premium 30mil magnetic material.',
    categoryPath: 'Vehicle Graphics > Magnetic Signs',
    basePrice: 39.99,
    costPrice: 15.00,
    pricingUnit: PricingUnit.EACH,
    minQuantity: 1,
    estimatedLeadDays: 3,
    tags: ['vehicle', 'magnetic', 'removable'],
    pricingTiers: [
      { minQty: 1, maxQty: 1, price: 39.99 },
      { minQty: 2, maxQty: 4, price: 34.99 },
      { minQty: 5, price: 29.99 },
    ],
  },
  {
    sku: 'WVEH-MAG-18X24',
    name: 'Magnetic Vehicle Sign (18"x24")',
    description: 'Large removable magnetic vehicle sign. Full-color on 30mil magnetic.',
    categoryPath: 'Vehicle Graphics > Magnetic Signs',
    basePrice: 49.99,
    costPrice: 20.00,
    pricingUnit: PricingUnit.EACH,
    minQuantity: 1,
    estimatedLeadDays: 3,
    tags: ['vehicle', 'magnetic', 'removable', 'large'],
  },

  // ============================================================
  // LARGE FORMAT PRINTING
  // ============================================================
  {
    sku: 'WLFP-POSTER',
    name: 'Custom Poster Print',
    description: 'Large format poster on premium photo paper or mounted on foam board. Vivid colors.',
    categoryPath: 'Large Format Printing > Posters & Prints',
    basePrice: 3.50,
    costPrice: 1.20,
    pricingUnit: PricingUnit.SQFT,
    minQuantity: 1,
    estimatedLeadDays: 3,
    tags: ['poster', 'print', 'large-format'],
  },
  {
    sku: 'WLFP-MOUNTED',
    name: 'Mounted Poster on Foam Board',
    description: 'Full-color poster mounted on 3/16" or 1/2" foam board. Optional lamination.',
    categoryPath: 'Large Format Printing > Posters & Prints',
    basePrice: 6.00,
    costPrice: 2.00,
    pricingUnit: PricingUnit.SQFT,
    minQuantity: 1,
    estimatedLeadDays: 3,
    tags: ['poster', 'foam-board', 'mounted'],
  },
  {
    sku: 'WLFP-WALL-MURAL',
    name: 'Custom Wall Mural',
    description: 'Full-wall custom mural printed on adhesive vinyl or re-positionable fabric. Any size.',
    categoryPath: 'Large Format Printing > Wall Graphics',
    basePrice: 8.00,
    costPrice: 3.00,
    pricingUnit: PricingUnit.SQFT,
    minQuantity: 1,
    estimatedLeadDays: 7,
    tags: ['wall', 'mural', 'large-format', 'custom'],
  },
  {
    sku: 'WLFP-WINDOW-PERF',
    name: 'Perforated Window Film',
    description: 'One-way vision window film. Full-color graphics visible from outside, see-through from inside.',
    categoryPath: 'Large Format Printing > Window Graphics',
    basePrice: 7.50,
    costPrice: 2.50,
    pricingUnit: PricingUnit.SQFT,
    minQuantity: 1,
    estimatedLeadDays: 5,
    tags: ['window', 'perforated', 'one-way', 'storefront'],
  },
  {
    sku: 'WLFP-WINDOW-CLING',
    name: 'Window Cling (Static)',
    description: 'Removable and repositionable static cling. No adhesive — perfect for temporary promotions.',
    categoryPath: 'Large Format Printing > Window Graphics',
    basePrice: 6.00,
    costPrice: 2.00,
    pricingUnit: PricingUnit.SQFT,
    minQuantity: 1,
    estimatedLeadDays: 3,
    tags: ['window', 'cling', 'removable', 'temporary'],
  },
  {
    sku: 'WLFP-FROSTED',
    name: 'Frosted Vinyl Window Film',
    description: 'Elegant frosted vinyl film for privacy and decoration. Custom cut designs available.',
    categoryPath: 'Large Format Printing > Window Graphics',
    basePrice: 5.50,
    costPrice: 1.80,
    pricingUnit: PricingUnit.SQFT,
    minQuantity: 1,
    estimatedLeadDays: 5,
    tags: ['window', 'frosted', 'privacy', 'decorative'],
  },
  {
    sku: 'WLFP-BACKLIT',
    name: 'Backlit Translite Print',
    description: 'Translucent print for backlit displays and light boxes. Vibrant colors that glow when illuminated.',
    categoryPath: 'Large Format Printing > Backlit & Translite',
    basePrice: 12.00,
    costPrice: 4.00,
    pricingUnit: PricingUnit.SQFT,
    minQuantity: 1,
    estimatedLeadDays: 5,
    tags: ['backlit', 'translite', 'light-box'],
  },

  // ============================================================
  // SERVICE CENTERS
  // ============================================================
  {
    sku: 'WSC-WINDSHIELD',
    name: 'Windshield Service Center',
    description: 'Customer convenience windshield cleaning station with custom sign insert. Black powder-coated steel construction.',
    categoryPath: 'Service Centers',
    basePrice: 199.99,
    costPrice: 90.00,
    pricingUnit: PricingUnit.EACH,
    minQuantity: 1,
    estimatedLeadDays: 10,
    tags: ['service-center', 'windshield', 'convenience'],
    pricingTiers: [
      { minQty: 1, maxQty: 2, price: 199.99 },
      { minQty: 3, maxQty: 5, price: 179.99 },
      { minQty: 6, price: 159.99 },
    ],
  },
  {
    sku: 'WSC-INSERT',
    name: 'Service Center Insert',
    description: 'Replacement or custom-designed insert for windshield service center displays.',
    categoryPath: 'Service Centers',
    basePrice: 24.99,
    costPrice: 8.00,
    pricingUnit: PricingUnit.EACH,
    minQuantity: 1,
    estimatedLeadDays: 5,
    tags: ['service-center', 'insert', 'custom'],
    artworkOptions: [
      { id: 'sc-generic', name: 'Generic Windshield Service', description: 'Standard service center design' },
      { id: 'sc-branded', name: 'Branded with Your Logo', description: 'Custom branded insert' },
    ],
  },

  // ============================================================
  // HARDWARE & ACCESSORIES
  // ============================================================
  {
    sku: 'WBAR-DESK-36',
    name: 'Desk Mount Protective Barrier (36"x31")',
    description: 'Safebloc™ polycarbonate desk-mount barrier. Unbreakable, clear, with product pass-through opening option.',
    categoryPath: 'Hardware & Accessories > Protective Barriers',
    basePrice: 89.99,
    costPrice: 40.00,
    pricingUnit: PricingUnit.EACH,
    minQuantity: 1,
    estimatedLeadDays: 7,
    tags: ['barrier', 'protective', 'desk-mount', 'polycarbonate'],
    pricingTiers: [
      { minQty: 1, maxQty: 2, price: 89.99 },
      { minQty: 3, maxQty: 4, price: 79.99 },
      { minQty: 5, price: 69.99 },
    ],
  },
  {
    sku: 'WBAR-COUNTER-24',
    name: 'Counter Mount Protective Barrier (24"x31")',
    description: 'Safebloc™ polycarbonate counter-mount barrier. Great for checkout counters and reception desks.',
    categoryPath: 'Hardware & Accessories > Protective Barriers',
    basePrice: 149.98,
    costPrice: 65.00,
    pricingUnit: PricingUnit.EACH,
    minQuantity: 1,
    estimatedLeadDays: 7,
    tags: ['barrier', 'protective', 'counter-mount', 'polycarbonate'],
  },
  {
    sku: 'WBAR-HANGING',
    name: 'Hanging Protective Barrier',
    description: 'Safebloc™ hanging polycarbonate barrier with ceiling mount hardware included.',
    categoryPath: 'Hardware & Accessories > Protective Barriers',
    basePrice: 324.98,
    costPrice: 130.00,
    pricingUnit: PricingUnit.EACH,
    minQuantity: 1,
    estimatedLeadDays: 7,
    tags: ['barrier', 'protective', 'hanging', 'polycarbonate'],
  },
  {
    sku: 'WHW-SUCTION-4PK',
    name: 'Suction Cups (4-Pack)',
    description: 'Heavy-duty suction cups for window sign mounting. Clear, professional look.',
    categoryPath: 'Hardware & Accessories > Mounting Hardware',
    basePrice: 4.99,
    costPrice: 1.50,
    pricingUnit: PricingUnit.PACK,
    minQuantity: 1,
    estimatedLeadDays: 2,
    tags: ['hardware', 'suction-cups', 'window-mount'],
  },
  {
    sku: 'WHW-STANDOFFS',
    name: 'Sign Standoff Kit (4-Pack)',
    description: 'Brushed aluminum sign standoffs for wall mounting acrylic or composite signs.',
    categoryPath: 'Hardware & Accessories > Mounting Hardware',
    basePrice: 24.99,
    costPrice: 10.00,
    pricingUnit: PricingUnit.PACK,
    minQuantity: 1,
    estimatedLeadDays: 3,
    tags: ['hardware', 'standoffs', 'wall-mount'],
  },
  {
    sku: 'WHW-H-STAKE',
    name: 'H-Wire Step Stakes (10-Pack)',
    description: '30" H-wire stakes for yard signs and corrugated plastic signs. Galvanized steel.',
    categoryPath: 'Hardware & Accessories > Stakes & Stands',
    basePrice: 19.99,
    costPrice: 8.00,
    pricingUnit: PricingUnit.PACK,
    minQuantity: 1,
    estimatedLeadDays: 2,
    tags: ['hardware', 'stakes', 'yard-sign'],
  },

  // ============================================================
  // TRADE SHOW & EVENTS
  // ============================================================
  {
    sku: 'WTS-POPUP-8FT',
    name: 'Pop-Up Display (8ft Curved)',
    description: '8ft curved fabric pop-up display with full-color dye-sublimation print. Includes carrying case.',
    categoryPath: 'Trade Show & Events > Pop-Up Displays',
    basePrice: 499.99,
    costPrice: 200.00,
    pricingUnit: PricingUnit.EACH,
    minQuantity: 1,
    estimatedLeadDays: 10,
    tags: ['trade-show', 'pop-up', 'display', 'fabric'],
  },
  {
    sku: 'WTS-POPUP-10FT',
    name: 'Pop-Up Display (10ft Straight)',
    description: '10ft straight fabric pop-up display. Portable, tool-free setup. Includes carrying case.',
    categoryPath: 'Trade Show & Events > Pop-Up Displays',
    basePrice: 599.99,
    costPrice: 250.00,
    pricingUnit: PricingUnit.EACH,
    minQuantity: 1,
    estimatedLeadDays: 10,
    tags: ['trade-show', 'pop-up', 'display', 'fabric', 'straight'],
  },
  {
    sku: 'WTS-TABLE-6FT',
    name: 'Custom Table Cover (6ft)',
    description: '6ft fitted table cover with full-color dye-sublimation print. Wrinkle-resistant fabric.',
    categoryPath: 'Trade Show & Events > Table Covers & Runners',
    basePrice: 149.99,
    costPrice: 55.00,
    pricingUnit: PricingUnit.EACH,
    minQuantity: 1,
    estimatedLeadDays: 7,
    tags: ['trade-show', 'table-cover', 'dye-sub'],
  },
  {
    sku: 'WTS-TABLE-8FT',
    name: 'Custom Table Cover (8ft)',
    description: '8ft fitted table cover with full-color dye-sublimation print.',
    categoryPath: 'Trade Show & Events > Table Covers & Runners',
    basePrice: 179.99,
    costPrice: 65.00,
    pricingUnit: PricingUnit.EACH,
    minQuantity: 1,
    estimatedLeadDays: 7,
    tags: ['trade-show', 'table-cover', 'dye-sub'],
  },
  {
    sku: 'WTS-RUNNER',
    name: 'Custom Table Runner',
    description: 'Custom table runner with full-color print. 24"x72" standard size.',
    categoryPath: 'Trade Show & Events > Table Covers & Runners',
    basePrice: 79.99,
    costPrice: 30.00,
    pricingUnit: PricingUnit.EACH,
    minQuantity: 1,
    estimatedLeadDays: 7,
    tags: ['trade-show', 'table-runner', 'dye-sub'],
  },
  {
    sku: 'WTS-STEP-REPEAT',
    name: 'Step and Repeat Backdrop (8\'x8\')',
    description: '8\'x8\' step-and-repeat banner with adjustable frame. Perfect for events and photo ops.',
    categoryPath: 'Trade Show & Events > Event Signage',
    basePrice: 299.99,
    costPrice: 120.00,
    pricingUnit: PricingUnit.EACH,
    minQuantity: 1,
    estimatedLeadDays: 7,
    tags: ['event', 'step-repeat', 'backdrop', 'photo'],
  },
  {
    sku: 'WTS-WELCOME',
    name: 'Event Welcome Sign (24"x36")',
    description: 'Custom welcome sign on foam board, coroplast, or PVC. Stand included.',
    categoryPath: 'Trade Show & Events > Event Signage',
    basePrice: 49.99,
    costPrice: 18.00,
    pricingUnit: PricingUnit.EACH,
    minQuantity: 1,
    estimatedLeadDays: 5,
    tags: ['event', 'welcome', 'sign'],
  },
];


// ============================================================
// SEED FUNCTION
// ============================================================
async function seed() {
  console.log('🌱 Seeding Wilde Signs Product Catalog (Generic Products)...\n');

  // Find admin user for createdById
  const adminUser = await prisma.user.findFirst({
    where: { role: 'ADMIN' },
    select: { id: true, username: true },
  });

  if (!adminUser) {
    console.error('❌ No admin user found. Run db:seed first (admin/admin123).');
    process.exit(1);
  }
  console.log(`  Using admin user: ${adminUser.username} (${adminUser.id})\n`);

  // Clear existing PriceBook data
  console.log('  🗑️  Clearing existing price book data...');
  await prisma.priceBookItem.deleteMany({});
  await prisma.priceBookCategory.deleteMany({});
  console.log('  ✅ Cleared.\n');

  // Create categories
  console.log('  📁 Creating categories...');
  const categoryMap = new Map<string, string>();

  for (const cat of CATEGORIES) {
    const parent = await prisma.priceBookCategory.create({
      data: {
        name: cat.name,
        description: cat.description,
        icon: cat.icon,
        color: cat.color,
        sortOrder: cat.sortOrder,
        isActive: true,
      },
    });
    categoryMap.set(cat.name, parent.id);
    console.log(`    ✅ ${cat.icon} ${cat.name}`);

    if (cat.children) {
      for (const child of cat.children) {
        const childRecord = await prisma.priceBookCategory.create({
          data: {
            name: child.name,
            description: child.description,
            icon: child.icon,
            color: child.color,
            sortOrder: child.sortOrder,
            parentId: parent.id,
            isActive: true,
          },
        });
        categoryMap.set(`${cat.name} > ${child.name}`, childRecord.id);
        console.log(`      └─ ${child.icon} ${child.name}`);
      }
    }
  }
  console.log(`\n  📊 Created ${categoryMap.size} categories.\n`);

  // Create products
  console.log('  📦 Creating products...');
  let created = 0;
  let skipped = 0;
  let withArtwork = 0;

  for (const prod of PRODUCTS) {
    const categoryId = categoryMap.get(prod.categoryPath);
    if (!categoryId) {
      console.warn(`    ⚠️  Category not found for "${prod.name}": ${prod.categoryPath}`);
      skipped++;
      continue;
    }

    await prisma.priceBookItem.create({
      data: {
        sku: prod.sku,
        name: prod.name,
        description: prod.description,
        categoryId,
        basePrice: prod.basePrice,
        costPrice: prod.costPrice,
        pricingUnit: prod.pricingUnit,
        minQuantity: prod.minQuantity,
        estimatedLeadDays: prod.estimatedLeadDays,
        tags: prod.tags,
        pricingTiers: prod.pricingTiers || [],
        artworkOptions: prod.artworkOptions ? (prod.artworkOptions as unknown as Prisma.InputJsonValue) : Prisma.DbNull,
        isActive: true,
        createdById: adminUser.id,
      },
    });
    created++;
    if (prod.artworkOptions && prod.artworkOptions.length > 0) withArtwork++;
  }

  console.log(`\n  📊 Created ${created} products (${withArtwork} with artwork options, ${skipped} skipped).\n`);

  // Summary
  const catCount = await prisma.priceBookCategory.count();
  const prodCount = await prisma.priceBookItem.count();
  console.log('═══════════════════════════════════════════════');
  console.log(`  ✅ Catalog seeded successfully!`);
  console.log(`     ${catCount} categories | ${prodCount} products`);
  console.log('═══════════════════════════════════════════════\n');
}

seed()
  .catch((err) => {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
