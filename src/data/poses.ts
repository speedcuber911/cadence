// ===========================================================================
// SVG pose library — inline stick-figure illustrations.
// `poseSvg(key, color)` returns a full SVG string (viewBox 0 0 300 300).
// Unknown keys fall back to a generic standing figure ("stand").
// ===========================================================================

const head = (x = 150, y = 74, r = 21) =>
  `<circle cx="${x}" cy="${y}" r="${r}" fill="url(#bodyGradient)" filter="url(#glow)"/>`

const limb = (points: string, width = 17) =>
  `<polyline points="${points}" fill="none" stroke="url(#bodyGradient)" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`

// ---------------------------------------------------------------------------
// Pose body builders. Each returns the inner figure markup (head + limbs).
// Coordinates are tuned for a 300x300 canvas with the ground around y=250.
// ---------------------------------------------------------------------------
const POSES: Record<string, () => string> = {
  // Generic standing figure.
  stand: () =>
    head(150, 70) +
    limb("150,91 150,165") + // torso
    limb("150,110 112,150") + // left arm
    limb("150,110 188,150") + // right arm
    limb("150,165 124,238") + // left leg
    limb("150,165 176,238"), // right leg

  // Arms out / arm circles.
  arms: () =>
    head(150, 70) +
    limb("150,91 150,165") +
    limb("150,108 95,92") + // left arm up-out
    limb("150,108 205,92") + // right arm up-out
    limb("150,165 124,238") +
    limb("150,165 176,238"),

  // Hands on hips (hip circles).
  hips: () =>
    head(150, 70) +
    limb("150,91 150,168") +
    limb("150,118 116,140 124,118") + // left arm to hip
    limb("150,118 184,140 176,118") + // right arm to hip
    limb("150,168 124,238") +
    limb("150,168 176,238"),

  // Hip hinge / good morning / inchworm.
  hinge: () =>
    head(112, 96) +
    limb("128,108 196,150") + // torso hinged forward
    limb("150,128 120,172") + // arm hanging
    limb("196,150 196,238") + // back leg
    limb("196,150 176,238"), // front leg

  // Squat / wall sit-ish base.
  squat: () =>
    head(150, 78) +
    limb("150,99 150,160") +
    limb("150,116 110,150") +
    limb("150,116 190,150") +
    limb("150,160 120,196 110,238") + // left leg bent
    limb("150,160 180,196 190,238"), // right leg bent

  // Wall sit — seated against vertical line.
  wallsit: () =>
    head(168, 96) +
    `<line x1="118" y1="40" x2="118" y2="250" stroke="url(#bodyGradient)" stroke-width="6" stroke-linecap="round" opacity="0.55"/>` +
    limb("130,118 168,118") + // torso along wall to seat
    limb("168,118 240,118") + // thighs horizontal
    limb("240,118 240,238") + // shins down
    limb("168,118 200,150"), // arm resting

  // Push-up.
  pushup: () =>
    head(78, 168) +
    limb("96,172 235,205") + // body line
    limb("110,176 100,238") + // arm down to floor
    limb("235,205 250,238"), // feet

  // Pike / downward dog inverted-V.
  downdog: () =>
    `<g>` +
    limb("70,238 150,120") + // arms+back up to hips
    limb("150,120 232,238") + // legs down
    head(110, 178, 16) +
    `</g>`,

  // Lunge (also used for stretches in lunge position).
  lunge: () =>
    head(150, 76) +
    limb("150,97 150,170") +
    limb("150,118 122,150") +
    limb("150,118 178,150") +
    limb("150,170 120,205 120,242") + // front leg bent
    limb("150,170 200,210 224,242"), // back leg extended

  // Plank.
  plank: () =>
    head(70, 170, 18) +
    limb("88,176 238,210") + // body line head->heels
    limb("100,180 96,238") + // forearm support
    limb("238,210 252,238"), // feet

  // Side plank.
  sideplank: () =>
    head(80, 150, 18) +
    limb("96,158 240,210") + // body on a diagonal
    limb("110,162 110,238") + // bottom arm to floor
    limb("150,168 170,120"), // top arm raised

  // Glute bridge / tricep dip (hips lifted, supported).
  bridge: () =>
    head(80, 200, 18) +
    limb("98,200 175,168") + // torso up to hips
    limb("175,168 235,238") + // thighs down to feet
    limb("100,206 96,238"), // arm to floor

  // Dead bug — on back, opposite arm/leg up.
  deadbug: () =>
    head(96, 168, 18) +
    limb("114,172 210,172") + // spine on floor
    limb("150,170 120,110") + // arm reaching up/back
    limb("190,172 230,120"), // leg lifted

  // Hollow hold / flutter kicks / russian twist (compact banana shape).
  hollow: () =>
    head(96, 150, 18) +
    limb("110,158 150,176 200,158") + // curved torso
    limb("120,160 96,120") + // arms overhead
    limb("200,158 240,128"), // legs raised

  // Bird dog — all fours, opposite arm/leg extended.
  birddog: () =>
    head(78, 158, 17) +
    limb("94,164 196,180") + // spine
    limb("110,170 100,238") + // support arm
    limb("180,180 180,238") + // support knee
    limb("96,160 60,118") + // extended arm forward
    limb("196,180 248,150"), // extended leg back

  // Mountain climber.
  climber: () =>
    head(74, 168, 17) +
    limb("92,174 236,206") + // plank body
    limb("104,178 98,238") + // arm
    limb("236,206 250,238") + // back foot
    limb("150,196 120,238"), // driven knee

  // Bear crawl hold.
  bearcrawl: () =>
    head(80, 168, 17) +
    limb("98,172 200,172") + // flat back
    limb("104,176 100,238") + // arm
    limb("194,176 192,238") + // knee/leg
    limb("150,172 150,196"), // hip lift hint

  // Shoulder taps — plank tapping shoulder.
  shouldertaps: () =>
    head(74, 168, 17) +
    limb("92,174 236,206") +
    limb("236,206 250,238") + // feet
    limb("100,178 96,238") + // support arm
    limb("130,184 110,160"), // tapping arm up to shoulder

  // Superman hold — face down, arms+legs lifted.
  superman: () =>
    head(70, 150, 17) +
    limb("86,156 220,176") + // arched body
    limb("82,152 50,120") + // arms forward+up
    limb("220,176 252,144"), // legs up

  // High knees.
  highknees: () =>
    head(150, 70) +
    limb("150,91 150,168") +
    limb("150,112 120,150") + // arm
    limb("150,112 180,82") + // arm pumping up
    limb("150,168 130,150 122,180") + // driven knee up
    limb("150,168 178,210 184,242"), // stance leg

  // Jumping jack / step jack — wide arms and legs.
  jumpingjack: () =>
    head(150, 70) +
    limb("150,91 150,170") +
    limb("150,104 96,64") + // left arm up-out
    limb("150,104 204,64") + // right arm up-out
    limb("150,170 108,242") + // left leg wide
    limb("150,170 192,242"), // right leg wide

  // Calf raise — up on toes.
  calfraise: () =>
    head(150, 72) +
    limb("150,93 150,170") +
    limb("150,116 124,150 130,118") + // hands at hips
    limb("150,116 176,150 170,118") +
    limb("150,170 142,232") + // leg
    limb("150,170 158,232") + // leg
    `<line x1="120" y1="240" x2="180" y2="240" stroke="url(#bodyGradient)" stroke-width="5" opacity="0.45" stroke-linecap="round"/>`,

  // Burpee / squat thrust — crouched, hands down.
  burpee: () =>
    head(120, 130, 18) +
    limb("136,140 196,180") + // torso to hips
    limb("140,150 120,238") + // arm reaching floor
    limb("196,180 170,238") + // leg
    limb("196,180 220,238"), // leg

  // Recovery / generic rest — relaxed seated.
  recovery: () =>
    head(150, 110, 19) +
    limb("150,128 150,190") +
    limb("150,150 110,180") +
    limb("150,150 190,180") +
    limb("150,190 110,210 150,232") +
    limb("150,190 190,210 150,232"),

  // Child's pose.
  child: () =>
    head(96, 200, 17) +
    limb("112,200 200,212") + // folded torso along floor
    limb("96,196 50,212") + // arms reaching forward
    limb("200,212 224,238"), // hips/heels

  // Generic stretch (standing reach).
  stretch: () =>
    head(150, 70) +
    limb("150,91 150,168") +
    limb("150,104 170,50") + // overhead reach
    limb("150,118 118,150") +
    limb("150,168 130,238") +
    limb("150,168 170,238"),

  // Hamstring stretch — seated forward fold.
  hamstring: () =>
    head(118, 150, 17) +
    limb("130,160 230,196") + // torso folding toward legs
    limb("130,196 230,196") + // extended legs on floor
    limb("140,160 210,190"), // arms reaching to foot

  // Chest / doorway stretch.
  chest: () =>
    head(150, 72) +
    limb("150,93 150,170") +
    limb("150,112 206,96 206,150") + // arm braced back on wall
    limb("150,112 116,150") + // other arm
    limb("150,170 132,238") +
    limb("150,170 168,238") +
    `<line x1="214" y1="40" x2="214" y2="250" stroke="url(#bodyGradient)" stroke-width="6" stroke-linecap="round" opacity="0.5"/>`,

  // Cobra stretch — chest up, hips down.
  cobra: () =>
    head(96, 138, 17) +
    limb("110,148 230,210") + // arched up from floor
    limb("112,152 108,210") + // arm pressing
    limb("230,210 252,214"), // legs on floor

  // Cat cow — all fours rounded spine.
  catcow: () =>
    head(80, 150, 17) +
    limb("96,156 150,134 210,156") + // rounded spine arch
    limb("104,160 100,238") + // arm
    limb("202,160 206,238"), // leg
}

/** Ordered list of every available pose key. */
export const POSE_KEYS: string[] = Object.keys(POSES)

/**
 * Render a pose as a self-contained SVG string.
 * Unknown keys fall back to the generic standing figure.
 */
export function poseSvg(key: string, color: string): string {
  const build = POSES[key] ?? POSES.stand
  const figure = build()

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300" width="100%" height="100%">
  <defs>
    <linearGradient id="bodyGradient" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${color}"/>
      <stop offset="100%" stop-color="#ffffff"/>
    </linearGradient>
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="3" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
  <circle cx="150" cy="150" r="140" fill="${color}" opacity="0.06"/>
  <ellipse cx="150" cy="262" rx="78" ry="12" fill="#000000" opacity="0.12"/>
  <g>${figure}</g>
  <path d="M 60 256 Q 150 244 240 256" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round" opacity="0.35"/>
</svg>`
}
