import { PrismaClient, PrintingMethod, OrderStatus, StationStatus } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// Helper to cast string arrays to PrintingMethod arrays
const stations = (...s: PrintingMethod[]): PrintingMethod[] => s;

async function main(): Promise<void> {
  console.log('🌱 Seeding database with Wilde Group data...');

  // Password for all users
  const password = await bcrypt.hash('bunda2026', 12);

  // ====== MODERATORS (all stations access) ======
  const jamie = await prisma.user.upsert({
    where: { username: 'jwilde' },
    update: { passwordHash: password },
    create: {
      username: 'jwilde',
      passwordHash: password,
      displayName: 'Jamie Wilde',
      email: 'jamie@wilde-signs.com',
      role: 'MANAGER',
      allowedStations: stations(PrintingMethod.ROLL_TO_ROLL, PrintingMethod.SCREEN_PRINT, PrintingMethod.PRODUCTION, PrintingMethod.FLATBED, PrintingMethod.DESIGN, PrintingMethod.SALES, PrintingMethod.INSTALLATION),
    },
  });

  const christina = await prisma.user.upsert({
    where: { username: 'cwilde' },
    update: { passwordHash: password },
    create: {
      username: 'cwilde',
      passwordHash: password,
      displayName: 'Christina Wilde',
      email: 'christina@wilde-signs.com',
      role: 'MANAGER',
      allowedStations: stations(PrintingMethod.ORDER_ENTRY, PrintingMethod.SHIPPING_RECEIVING, PrintingMethod.SALES),
    },
  });

  // ====== ADMIN ======
  const jacob = await prisma.user.upsert({
    where: { username: 'jbunda' },
    update: { passwordHash: password },
    create: {
      username: 'jbunda',
      passwordHash: password,
      displayName: 'Jacob Bunda',
      email: 'jacob@wilde-signs.com',
      role: 'ADMIN',
      allowedStations: stations(PrintingMethod.ROLL_TO_ROLL, PrintingMethod.SCREEN_PRINT, PrintingMethod.PRODUCTION, PrintingMethod.FLATBED, PrintingMethod.DESIGN),
    },
  });
  console.log(`✅ Created admin user: ${jacob.username}`);

  // ====== OPERATORS ======
  const pamela = await prisma.user.upsert({
    where: { username: 'plelonde' },
    update: { passwordHash: password },
    create: {
      username: 'plelonde',
      passwordHash: password,
      displayName: 'Pamela Lelonde',
      email: 'pamela@wilde-signs.com',
      role: 'OPERATOR',
      allowedStations: stations(PrintingMethod.SHIPPING_RECEIVING),
    },
  });

  const brenda = await prisma.user.upsert({
    where: { username: 'bwolff' },
    update: { passwordHash: password },
    create: {
      username: 'bwolff',
      passwordHash: password,
      displayName: 'Brenda Wolff',
      email: 'brenda@wilde-signs.com',
      role: 'OPERATOR',
      allowedStations: stations(PrintingMethod.ORDER_ENTRY),
    },
  });

  const gary = await prisma.user.upsert({
    where: { username: 'gflowers' },
    update: { passwordHash: password },
    create: {
      username: 'gflowers',
      passwordHash: password,
      displayName: 'Gary Flowers',
      email: 'gary@wilde-signs.com',
      role: 'OPERATOR',
      allowedStations: stations(PrintingMethod.SCREEN_PRINT, PrintingMethod.PRODUCTION),
    },
  });

  const typhanie = await prisma.user.upsert({
    where: { username: 'thall' },
    update: { passwordHash: password },
    create: {
      username: 'thall',
      passwordHash: password,
      displayName: 'Typhanie Hall',
      email: 'typhanie@wilde-signs.com',
      role: 'OPERATOR',
      allowedStations: stations(PrintingMethod.PRODUCTION),
    },
  });

  const deven = await prisma.user.upsert({
    where: { username: 'drossi' },
    update: { passwordHash: password },
    create: {
      username: 'drossi',
      passwordHash: password,
      displayName: 'Deven Rossi',
      email: 'deven@wilde-signs.com',
      role: 'OPERATOR',
      allowedStations: stations(PrintingMethod.PRODUCTION),
    },
  });

  const lena = await prisma.user.upsert({
    where: { username: 'lcook' },
    update: { passwordHash: password },
    create: {
      username: 'lcook',
      passwordHash: password,
      displayName: 'Lena Cook',
      email: 'lena@wilde-signs.com',
      role: 'OPERATOR',
      allowedStations: stations(PrintingMethod.DESIGN),
    },
  });

  const ashley = await prisma.user.upsert({
    where: { username: 'avisser' },
    update: { passwordHash: password },
    create: {
      username: 'avisser',
      passwordHash: password,
      displayName: 'Ashley Visser',
      email: 'ashley@wilde-signs.com',
      role: 'OPERATOR',
      allowedStations: stations(PrintingMethod.DESIGN),
    },
  });

  const aaron = await prisma.user.upsert({
    where: { username: 'aeikenberry' },
    update: { passwordHash: password },
    create: {
      username: 'aeikenberry',
      passwordHash: password,
      displayName: 'Aaron Eikenberry',
      email: 'aaron@wilde-signs.com',
      role: 'OPERATOR',
      allowedStations: stations(PrintingMethod.DESIGN),
    },
  });

  const shawn = await prisma.user.upsert({
    where: { username: 'szimmerman' },
    update: { passwordHash: password },
    create: {
      username: 'szimmerman',
      passwordHash: password,
      displayName: 'Shawn Zimmerman',
      email: 'shawn@portcitysigns1.com',
      role: 'OPERATOR',
      allowedStations: stations(PrintingMethod.SALES),
    },
  });

  const tony = await prisma.user.upsert({
    where: { username: 'tripple' },
    update: { passwordHash: password },
    create: {
      username: 'tripple',
      passwordHash: password,
      displayName: 'Tony Ripple',
      email: 'tony@portcitysigns1.com',
      role: 'OPERATOR',
      allowedStations: stations(PrintingMethod.INSTALLATION),
    },
  });

  const jose = await prisma.user.upsert({
    where: { username: 'jwatson' },
    update: { passwordHash: password },
    create: {
      username: 'jwatson',
      passwordHash: password,
      displayName: 'Jose Watson',
      email: 'jose@portcitysigns1.com',
      role: 'OPERATOR',
      allowedStations: stations(PrintingMethod.INSTALLATION),
    },
  });

  // Create admin user for testing
  const adminPassword = await bcrypt.hash('admin123', 12);
  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: { passwordHash: adminPassword },
    create: {
      username: 'admin',
      passwordHash: adminPassword,
      displayName: 'System Admin',
      email: 'admin@wilde-signs.com',
      role: 'ADMIN',
      allowedStations: stations(PrintingMethod.ROLL_TO_ROLL, PrintingMethod.SCREEN_PRINT, PrintingMethod.PRODUCTION, PrintingMethod.FLATBED, PrintingMethod.DESIGN, PrintingMethod.SALES, PrintingMethod.INSTALLATION, PrintingMethod.ORDER_ENTRY, PrintingMethod.SHIPPING_RECEIVING),
    },
  });

  console.log(`✅ Created 15 users (1 admin, 2 moderators, 12 operators)`);

  // Create comprehensive item masters from real suppliers
  // Sources: General Formulations, Grimco, Laird Plastics
  const items = [
    // ========== ROLLED VINYL (General Formulations / Grimco) ==========
    // Calendered Vinyl
    { sku: 'GF-201', name: 'GF 201 Sign Vinyl - White Gloss', category: 'Rolled Vinyl', unitPrice: 85.00, costPrice: 42.00 },
    { sku: 'GF-201M', name: 'GF 201 Sign Vinyl - White Matte', category: 'Rolled Vinyl', unitPrice: 85.00, costPrice: 42.00 },
    { sku: 'GF-202', name: 'GF 202 Intermediate Vinyl - White Gloss', category: 'Rolled Vinyl', unitPrice: 95.00, costPrice: 48.00 },
    { sku: 'GF-203', name: 'GF 203 Premium Vinyl - White Gloss', category: 'Rolled Vinyl', unitPrice: 125.00, costPrice: 62.00 },
    { sku: 'GF-206', name: 'GF 206 Perforated Window Film', category: 'Rolled Vinyl', unitPrice: 145.00, costPrice: 72.00 },
    { sku: 'GF-207', name: 'GF 207 Static Cling Clear', category: 'Rolled Vinyl', unitPrice: 110.00, costPrice: 55.00 },
    { sku: 'GF-211', name: 'GF 211 Frosted Etch Vinyl', category: 'Rolled Vinyl', unitPrice: 95.00, costPrice: 48.00 },
    { sku: 'GF-212', name: 'GF 212 Reflective Vinyl - White', category: 'Rolled Vinyl', unitPrice: 185.00, costPrice: 92.00 },
    // Cast Vinyl
    { sku: 'GF-230', name: 'GF 230 Cast Vinyl - White Gloss 54"', category: 'Rolled Vinyl', unitPrice: 275.00, costPrice: 138.00 },
    { sku: 'GF-231', name: 'GF 231 Cast Vinyl - Black Gloss 54"', category: 'Rolled Vinyl', unitPrice: 275.00, costPrice: 138.00 },
    { sku: 'GF-232', name: 'GF 232 Cast Vinyl - Clear 54"', category: 'Rolled Vinyl', unitPrice: 295.00, costPrice: 148.00 },
    { sku: 'GF-233', name: 'GF 233 Cast Vinyl Wrap Film - White', category: 'Rolled Vinyl', unitPrice: 325.00, costPrice: 162.00 },
    { sku: 'GF-234', name: 'GF 234 Cast Vinyl Wrap Film - Black', category: 'Rolled Vinyl', unitPrice: 325.00, costPrice: 162.00 },
    // Specialty Vinyl
    { sku: 'GF-220', name: 'GF 220 Floor Graphic Film', category: 'Rolled Vinyl', unitPrice: 165.00, costPrice: 82.00 },
    { sku: 'GF-221', name: 'GF 221 Wall Graphic Film', category: 'Rolled Vinyl', unitPrice: 145.00, costPrice: 72.00 },
    { sku: 'GF-225', name: 'GF 225 Blockout Banner Film', category: 'Rolled Vinyl', unitPrice: 135.00, costPrice: 68.00 },
    
    // ========== ROLLED LAMINATES (General Formulations) ==========
    { sku: 'GF-241', name: 'GF 241 Gloss Laminate 54"', category: 'Laminates', unitPrice: 165.00, costPrice: 82.00 },
    { sku: 'GF-242', name: 'GF 242 Matte Laminate 54"', category: 'Laminates', unitPrice: 165.00, costPrice: 82.00 },
    { sku: 'GF-243', name: 'GF 243 Luster Laminate 54"', category: 'Laminates', unitPrice: 175.00, costPrice: 88.00 },
    { sku: 'GF-244', name: 'GF 244 Textured Laminate 54"', category: 'Laminates', unitPrice: 185.00, costPrice: 92.00 },
    { sku: 'GF-245', name: 'GF 245 Anti-Graffiti Laminate', category: 'Laminates', unitPrice: 225.00, costPrice: 112.00 },
    { sku: 'GF-246', name: 'GF 246 Floor Laminate Non-Slip', category: 'Laminates', unitPrice: 245.00, costPrice: 122.00 },
    { sku: 'GF-247', name: 'GF 247 UV Laminate Heavy Duty', category: 'Laminates', unitPrice: 195.00, costPrice: 98.00 },
    
    // ========== RIGID SUBSTRATES - STYRENE (Laird Plastics) ==========
    { sku: 'STY-020-48', name: 'Styrene .020" White 48x96', category: 'Styrene', unitPrice: 28.00, costPrice: 14.00 },
    { sku: 'STY-030-48', name: 'Styrene .030" White 48x96', category: 'Styrene', unitPrice: 32.00, costPrice: 16.00 },
    { sku: 'STY-040-48', name: 'Styrene .040" White 48x96', category: 'Styrene', unitPrice: 38.00, costPrice: 19.00 },
    { sku: 'STY-060-48', name: 'Styrene .060" White 48x96', category: 'Styrene', unitPrice: 48.00, costPrice: 24.00 },
    { sku: 'STY-080-48', name: 'Styrene .080" White 48x96', category: 'Styrene', unitPrice: 58.00, costPrice: 29.00 },
    { sku: 'STY-118-48', name: 'Styrene .118" (1/8") White 48x96', category: 'Styrene', unitPrice: 72.00, costPrice: 36.00 },
    
    // ========== COROPLAST / CORRUGATED PLASTIC (Grimco) ==========
    { sku: 'COR-4MM-48W', name: 'Coroplast 4mm White 48x96', category: 'Coroplast', unitPrice: 18.00, costPrice: 9.00 },
    { sku: 'COR-4MM-48N', name: 'Coroplast 4mm Natural 48x96', category: 'Coroplast', unitPrice: 16.00, costPrice: 8.00 },
    { sku: 'COR-4MM-18W', name: 'Coroplast 4mm White 18x24', category: 'Coroplast', unitPrice: 4.50, costPrice: 2.25 },
    { sku: 'COR-4MM-24W', name: 'Coroplast 4mm White 24x36', category: 'Coroplast', unitPrice: 8.00, costPrice: 4.00 },
    { sku: 'COR-6MM-48W', name: 'Coroplast 6mm White 48x96', category: 'Coroplast', unitPrice: 28.00, costPrice: 14.00 },
    { sku: 'COR-8MM-48W', name: 'Coroplast 8mm White 48x96', category: 'Coroplast', unitPrice: 38.00, costPrice: 19.00 },
    { sku: 'COR-10MM-48W', name: 'Coroplast 10mm White 48x96', category: 'Coroplast', unitPrice: 48.00, costPrice: 24.00 },
    
    // ========== ACRYLIC (Laird Plastics) ==========
    { sku: 'ACR-118-CL', name: 'Acrylic 1/8" Clear 48x96', category: 'Acrylic', unitPrice: 165.00, costPrice: 82.00 },
    { sku: 'ACR-118-WH', name: 'Acrylic 1/8" White 48x96', category: 'Acrylic', unitPrice: 145.00, costPrice: 72.00 },
    { sku: 'ACR-118-BK', name: 'Acrylic 1/8" Black 48x96', category: 'Acrylic', unitPrice: 155.00, costPrice: 78.00 },
    { sku: 'ACR-188-CL', name: 'Acrylic 3/16" Clear 48x96', category: 'Acrylic', unitPrice: 195.00, costPrice: 98.00 },
    { sku: 'ACR-250-CL', name: 'Acrylic 1/4" Clear 48x96', category: 'Acrylic', unitPrice: 245.00, costPrice: 122.00 },
    { sku: 'ACR-250-WH', name: 'Acrylic 1/4" White 48x96', category: 'Acrylic', unitPrice: 225.00, costPrice: 112.00 },
    { sku: 'ACR-375-CL', name: 'Acrylic 3/8" Clear 48x96', category: 'Acrylic', unitPrice: 345.00, costPrice: 172.00 },
    { sku: 'ACR-500-CL', name: 'Acrylic 1/2" Clear 48x96', category: 'Acrylic', unitPrice: 425.00, costPrice: 212.00 },
    
    // ========== SINTRA / PVC FOAM BOARD (Laird Plastics / Grimco) ==========
    { sku: 'SIN-3MM-WH', name: 'Sintra 3mm White 48x96', category: 'Sintra/PVC', unitPrice: 52.00, costPrice: 26.00 },
    { sku: 'SIN-3MM-BK', name: 'Sintra 3mm Black 48x96', category: 'Sintra/PVC', unitPrice: 58.00, costPrice: 29.00 },
    { sku: 'SIN-6MM-WH', name: 'Sintra 6mm White 48x96', category: 'Sintra/PVC', unitPrice: 72.00, costPrice: 36.00 },
    { sku: 'SIN-6MM-BK', name: 'Sintra 6mm Black 48x96', category: 'Sintra/PVC', unitPrice: 78.00, costPrice: 39.00 },
    { sku: 'SIN-10MM-WH', name: 'Sintra 10mm White 48x96', category: 'Sintra/PVC', unitPrice: 95.00, costPrice: 48.00 },
    { sku: 'SIN-13MM-WH', name: 'Sintra 13mm (1/2") White 48x96', category: 'Sintra/PVC', unitPrice: 115.00, costPrice: 58.00 },
    { sku: 'SIN-19MM-WH', name: 'Sintra 19mm (3/4") White 48x96', category: 'Sintra/PVC', unitPrice: 145.00, costPrice: 72.00 },
    
    // ========== ALUPANEL / DIBOND / ACM (Grimco / Laird Plastics) ==========
    { sku: 'ACM-3MM-WH', name: 'Alupanel 3mm White 48x96', category: 'Aluminum Composite', unitPrice: 125.00, costPrice: 62.00 },
    { sku: 'ACM-3MM-BK', name: 'Alupanel 3mm Black 48x96', category: 'Aluminum Composite', unitPrice: 135.00, costPrice: 68.00 },
    { sku: 'ACM-3MM-BR', name: 'Alupanel 3mm Brushed Silver 48x96', category: 'Aluminum Composite', unitPrice: 155.00, costPrice: 78.00 },
    { sku: 'ACM-3MM-GD', name: 'Alupanel 3mm Gold 48x96', category: 'Aluminum Composite', unitPrice: 165.00, costPrice: 82.00 },
    { sku: 'ACM-4MM-WH', name: 'Alupanel 4mm White 48x120', category: 'Aluminum Composite', unitPrice: 185.00, costPrice: 92.00 },
    { sku: 'ACM-4MM-BK', name: 'Alupanel 4mm Black 48x120', category: 'Aluminum Composite', unitPrice: 195.00, costPrice: 98.00 },
    { sku: 'DIBOND-3MM', name: 'Dibond 3mm White 48x96', category: 'Aluminum Composite', unitPrice: 145.00, costPrice: 72.00 },
    
    // ========== FOAM BOARD / GATORBOARD (Grimco) ==========
    { sku: 'FB-3MM-WH', name: 'Foam Board 3/16" White 48x96', category: 'Foam Board', unitPrice: 22.00, costPrice: 11.00 },
    { sku: 'FB-5MM-WH', name: 'Foam Board 1/2" White 48x96', category: 'Foam Board', unitPrice: 42.00, costPrice: 21.00 },
    { sku: 'GATOR-3MM', name: 'Gatorboard 3/16" White 48x96', category: 'Foam Board', unitPrice: 58.00, costPrice: 29.00 },
    { sku: 'GATOR-5MM', name: 'Gatorboard 1/2" White 48x96', category: 'Foam Board', unitPrice: 85.00, costPrice: 42.00 },
    { sku: 'GATOR-10MM', name: 'Gatorboard 1" White 48x96', category: 'Foam Board', unitPrice: 125.00, costPrice: 62.00 },
    
    // ========== BANNER MATERIALS (Grimco / General Formulations) ==========
    { sku: 'BAN-13OZ', name: 'Banner 13oz Matte 54" x 40yd', category: 'Banner Material', unitPrice: 165.00, costPrice: 82.00 },
    { sku: 'BAN-15OZ', name: 'Banner 15oz Blockout 54" x 40yd', category: 'Banner Material', unitPrice: 195.00, costPrice: 98.00 },
    { sku: 'BAN-MESH', name: 'Mesh Banner 9oz 54" x 40yd', category: 'Banner Material', unitPrice: 145.00, costPrice: 72.00 },
    { sku: 'BAN-FABRIC', name: 'Fabric Banner Polyester 54" x 40yd', category: 'Banner Material', unitPrice: 245.00, costPrice: 122.00 },
    { sku: 'BAN-CANVAS', name: 'Canvas Banner 18oz 54" x 40yd', category: 'Banner Material', unitPrice: 285.00, costPrice: 142.00 },
    { sku: 'BAN-BACKLIT', name: 'Backlit Film 54" x 100ft', category: 'Banner Material', unitPrice: 325.00, costPrice: 162.00 },
    
    // ========== TRANSFER TAPES & APPLICATION TOOLS ==========
    { sku: 'AT-HT-12', name: 'Application Tape High Tack 12" x 300ft', category: 'Transfer Tape', unitPrice: 48.00, costPrice: 24.00 },
    { sku: 'AT-MT-12', name: 'Application Tape Medium Tack 12" x 300ft', category: 'Transfer Tape', unitPrice: 42.00, costPrice: 21.00 },
    { sku: 'AT-PAPER-12', name: 'Paper Application Tape 12" x 300ft', category: 'Transfer Tape', unitPrice: 35.00, costPrice: 18.00 },
    { sku: 'AT-HT-48', name: 'Application Tape High Tack 48" x 100yd', category: 'Transfer Tape', unitPrice: 125.00, costPrice: 62.00 },
    
    // ========== HARDWARE (Grimco) ==========
    { sku: 'HW-RETRACT-33', name: 'Retractable Banner Stand 33"x80"', category: 'Hardware', unitPrice: 125.00, costPrice: 55.00 },
    { sku: 'HW-RETRACT-47', name: 'Retractable Banner Stand 47"x80"', category: 'Hardware', unitPrice: 165.00, costPrice: 72.00 },
    { sku: 'HW-AFRAME-24', name: 'A-Frame Sidewalk Sign 24"x36"', category: 'Hardware', unitPrice: 85.00, costPrice: 35.00 },
    { sku: 'HW-HSTAKE', name: 'Wire H-Stakes 10"x30" (10 pack)', category: 'Hardware', unitPrice: 18.00, costPrice: 8.00 },
    { sku: 'HW-USTAKE', name: 'U-Top Yard Sign Stakes (25 pack)', category: 'Hardware', unitPrice: 45.00, costPrice: 22.00 },
    { sku: 'HW-GROMMET-KIT', name: 'Grommet Kit 3/8" with Tool', category: 'Hardware', unitPrice: 28.00, costPrice: 12.00 },
  ];

  for (const item of items) {
    await prisma.itemMaster.upsert({
      where: { sku: item.sku },
      update: {},
      create: item,
    });
  }
  console.log(`✅ Created ${items.length} item masters`);

  // Get all item masters for inventory
  const allItems = await prisma.itemMaster.findMany();
  console.log(`✅ ${allItems.length} item masters ready`);

  // Create templates based on Wilde Signs online store products (shop.wilde-signs.com)
  const templates = [
    // Gas Station / C-Store Templates
    {
      name: 'Gas Station Pump Topper Package',
      description: 'Complete pump topper signage with frames - based on shop.wilde-signs.com products',
      defaultRouting: [PrintingMethod.DESIGN, PrintingMethod.FLATBED, PrintingMethod.SHIPPING_RECEIVING] as PrintingMethod[],
      customerName: '',
      lineItemTemplates: [
        { description: 'Pump Topper Frames (6pk)', quantity: 1, unitPrice: 185.00 },
        { description: 'Custom Pump Topper Insert 22x12', quantity: 6, unitPrice: 18.00 },
      ],
    },
    {
      name: 'Gas Station Decal Kit',
      description: 'Octane rating and pump decals package',
      defaultRouting: [PrintingMethod.PRODUCTION, PrintingMethod.SHIPPING_RECEIVING] as PrintingMethod[],
      customerName: '',
      lineItemTemplates: [
        { description: 'Octane Rating Decal Pack (87)', quantity: 1, unitPrice: 12.00 },
        { description: 'Octane Rating Decal Pack (89)', quantity: 1, unitPrice: 12.00 },
        { description: 'Octane Rating Decal Pack (93)', quantity: 1, unitPrice: 12.00 },
        { description: 'Diesel Pump Decal 12x4', quantity: 6, unitPrice: 8.00 },
      ],
    },
    {
      name: 'C-Store Poster Frame Package',
      description: 'Complete poster frame and insert signage for convenience stores',
      defaultRouting: [PrintingMethod.DESIGN, PrintingMethod.FLATBED, PrintingMethod.SHIPPING_RECEIVING] as PrintingMethod[],
      customerName: '',
      lineItemTemplates: [
        { description: 'Wall Mount Snap Lock Sign Frame - Large', quantity: 4, unitPrice: 45.00 },
        { description: 'Poster Frame Insert - Custom Design', quantity: 4, unitPrice: 22.00 },
        { description: 'Poster Frame Insert - Now Hiring', quantity: 2, unitPrice: 15.00 },
        { description: 'Poster Frame Insert - ATM Inside', quantity: 1, unitPrice: 15.00 },
      ],
    },
    // Floor Graphics & Social Distancing
    {
      name: 'Floor Graphics Package',
      description: 'Custom floor graphics and directional signage',
      defaultRouting: [PrintingMethod.DESIGN, PrintingMethod.ROLL_TO_ROLL, PrintingMethod.PRODUCTION] as PrintingMethod[],
      customerName: '',
      lineItemTemplates: [
        { description: 'Floor Graphic - Circle 12" diameter', quantity: 10, unitPrice: 18.00 },
        { description: 'Floor Graphic - Directional Arrow', quantity: 6, unitPrice: 15.00 },
        { description: 'Anti-slip laminate application', quantity: 16, unitPrice: 3.00 },
      ],
    },
    // Sign Frames & Stands
    {
      name: 'Sidewalk A-Frame Package',
      description: 'A-frame sidewalk sign with custom inserts',
      defaultRouting: [PrintingMethod.DESIGN, PrintingMethod.FLATBED, PrintingMethod.SHIPPING_RECEIVING] as PrintingMethod[],
      customerName: '',
      lineItemTemplates: [
        { description: 'Deluxe A-Frame Sign Stand', quantity: 1, unitPrice: 125.00 },
        { description: 'A-Frame Insert - Custom Design 24x36', quantity: 2, unitPrice: 45.00 },
      ],
    },
    {
      name: 'Curb Sign Package',
      description: 'Classic curb sign with custom messaging',
      defaultRouting: [PrintingMethod.DESIGN, PrintingMethod.FLATBED, PrintingMethod.SHIPPING_RECEIVING] as PrintingMethod[],
      customerName: '',
      lineItemTemplates: [
        { description: 'Classic Curb Sign Frame - Small', quantity: 1, unitPrice: 95.00 },
        { description: 'Curb Sign Insert - Custom Design', quantity: 2, unitPrice: 35.00 },
      ],
    },
    // Vehicle & Window Graphics
    {
      name: 'Vehicle Wrap - Full',
      description: 'Full vehicle wrap with design and installation',
      defaultRouting: [PrintingMethod.DESIGN, PrintingMethod.ROLL_TO_ROLL, PrintingMethod.INSTALLATION] as PrintingMethod[],
      customerName: '',
      lineItemTemplates: [
        { description: 'Full vehicle wrap - design', quantity: 1, unitPrice: 500.00 },
        { description: 'Full vehicle wrap - print & laminate', quantity: 1, unitPrice: 1200.00 },
        { description: 'Full vehicle wrap - installation', quantity: 1, unitPrice: 800.00 },
      ],
    },
    {
      name: 'Window Graphics Package',
      description: 'Business window graphics with hours and logo',
      defaultRouting: [PrintingMethod.DESIGN, PrintingMethod.ROLL_TO_ROLL] as PrintingMethod[],
      customerName: '',
      lineItemTemplates: [
        { description: 'Window logo vinyl', quantity: 1, unitPrice: 150.00 },
        { description: 'Business hours vinyl', quantity: 1, unitPrice: 45.00 },
        { description: 'Frosted privacy strip', quantity: 1, unitPrice: 85.00 },
      ],
    },
    // Changeable Price Signs
    {
      name: 'Changeable Price Sign Set',
      description: 'Spiral bound flip signs for milk and eggs pricing',
      defaultRouting: [PrintingMethod.PRODUCTION, PrintingMethod.SHIPPING_RECEIVING] as PrintingMethod[],
      customerName: '',
      lineItemTemplates: [
        { description: 'Milk Gallon - Spiral Bound Changeable Price Sign', quantity: 2, unitPrice: 28.00 },
        { description: 'Dozen Eggs - Spiral Bound Changeable Price Sign', quantity: 2, unitPrice: 28.00 },
      ],
    },
    // Trade Show
    {
      name: 'Trade Show Package',
      description: 'Complete trade show booth signage',
      defaultRouting: [PrintingMethod.DESIGN, PrintingMethod.ROLL_TO_ROLL, PrintingMethod.PRODUCTION] as PrintingMethod[],
      customerName: '',
      lineItemTemplates: [
        { description: 'Retractable banner stand 33x80', quantity: 2, unitPrice: 175.00 },
        { description: 'Table throw 6ft - custom print', quantity: 1, unitPrice: 250.00 },
        { description: 'Backdrop 10x8ft - fabric', quantity: 1, unitPrice: 450.00 },
      ],
    },
    // Protective Barriers (from COVID era but still popular)
    {
      name: 'Protective Barrier Package',
      description: 'Safebloc protective barriers for counters',
      defaultRouting: [PrintingMethod.PRODUCTION, PrintingMethod.SHIPPING_RECEIVING] as PrintingMethod[],
      customerName: '',
      lineItemTemplates: [
        { description: 'Safebloc Protective Barrier - Standard', quantity: 2, unitPrice: 125.00 },
        { description: 'Safebloc Protective Barrier - Large', quantity: 1, unitPrice: 175.00 },
      ],
    },
    // Yard Signs
    {
      name: 'Yard Sign Package',
      description: 'Coroplast yard signs with ground stakes',
      defaultRouting: [PrintingMethod.DESIGN, PrintingMethod.FLATBED, PrintingMethod.SHIPPING_RECEIVING] as PrintingMethod[],
      customerName: '',
      lineItemTemplates: [
        { description: 'Yard Sign Coroplast 18x24 - Double Sided', quantity: 25, unitPrice: 18.00 },
        { description: 'U-Top Yard Sign Stakes', quantity: 25, unitPrice: 3.50 },
      ],
    },
  ];

  for (const template of templates) {
    const { lineItemTemplates, ...templateData } = template;
    await prisma.orderTemplate.upsert({
      where: { name: template.name },
      update: {},
      create: {
        ...templateData,
        createdById: jacob.id,
        lineItemTemplates: {
          create: lineItemTemplates,
        },
      },
    });
  }
  console.log(`✅ Created ${templates.length} order templates`);

  console.log('');
  console.log('🎉 Seeding complete!');
  console.log('');
  console.log('📋 Login credentials:');
  console.log('   Admin (test):  admin / admin123');
  console.log('   All users:     [username] / bunda2026');
  console.log('');
  console.log('   Usernames: jbunda, jwilde, cwilde, plelonde, bwolff, gflowers,');
  console.log('              thall, drossi, lcook, avisser, aeikenberry,');
  console.log('              szimmerman, tripple, jwatson');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
