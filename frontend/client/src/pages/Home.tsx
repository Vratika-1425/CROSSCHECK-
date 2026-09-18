import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { ChangeEvent, ReactNode, RefObject } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  ArrowDownRight,
  ArrowUpRight,
  AlertTriangle,
  Bot,
  Camera,
  CalendarDays,
  CarFront,
  Check,
  ChevronDown,
  Crosshair,
  Copy,
  Eye,
  FileText,
  Layers3,
  MapPin,
  Menu,
  Minus,
  MoveRight,
  Navigation,
  Radio,
  ScanLine,
  Search,
  Trophy,
  TrendingUp,
  Upload,
  X,
} from "lucide-react";
import {
  API_ENABLED,
  askAssistant,
  fetchProjects,
  uploadDataset,
} from "@/lib/api";

const VIDEO_SRC =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260403_050628_c4e32401-fab4-4a27-b7a8-6e9291cd5959.mp4";

const chapterLinks = [
  { label: "Story", href: "#story" },
  { label: "Detect", href: "#detect" },
  { label: "Network", href: "#network" },
  { label: "Impact", href: "#impact" },
];

type ProjectType = "Water" | "Electrical" | "Telecom" | "Metro" | "Roadworks" | "Drainage";
type FilterType = "ALL" | ProjectType | "Traffic" | "Collisions";

type Project = {
  id: string;
  name: string;
  type: ProjectType;
  agency: string;
  location: string;
  road: string;
  start: string;
  end: string;
  x: number;
  y: number;
  impact: number;
  disruption: string;
  color: string;
};

const projects: Project[] = [
  { id: "BW-104", name: "Richmond Road Water Main Renewal", type: "Water", agency: "BWSSB", location: "Richmond Road", road: "Richmond Road", start: "2024-06-12", end: "2024-12-08", x: 405, y: 237, impact: 72, disruption: "Water pipeline work + lane closure", color: "#78a6a3" },
  { id: "BBMP-221", name: "Richmond Road Resurfacing", type: "Roadworks", agency: "BBMP", location: "Richmond Road", road: "Richmond Road", start: "2024-08-01", end: "2024-10-15", x: 428, y: 235, impact: 84, disruption: "Road construction + lane closure", color: "#d47f58" },
  { id: "BESCOM-071", name: "Central Grid Reliability Upgrade", type: "Electrical", agency: "BESCOM", location: "Magrath Road", road: "Magrath Road", start: "2024-09-04", end: "2025-01-18", x: 515, y: 198, impact: 48, disruption: "Electrical work", color: "#dfc26a" },
  { id: "BLR-039", name: "Purple Line East Extension", type: "Metro", agency: "BMRCL", location: "MG Road / Ulsoor", road: "MG Road", start: "2024-07-18", end: "2025-04-22", x: 650, y: 288, impact: 91, disruption: "Metro construction + multiple lane closures", color: "#c5a2c9" },
  { id: "BBMP-198", name: "Indiranagar Storm Drain Renewal", type: "Drainage", agency: "BBMP", location: "12th Main, Indiranagar", road: "12th Main", start: "2024-10-01", end: "2024-12-20", x: 760, y: 180, impact: 56, disruption: "Drainage work", color: "#93a46e" },
  { id: "ACT-140", name: "Fiber Backbone Phase 4", type: "Telecom", agency: "ACT Fibernet", location: "100 Feet Road", road: "100 Feet Road", start: "2024-08-20", end: "2024-11-05", x: 650, y: 292, impact: 43, disruption: "Telecom work", color: "#9d9bb8" },
  { id: "BW-122", name: "Koramangala Trunk Sewer", type: "Drainage", agency: "BWSSB", location: "80 Feet Road", road: "80 Feet Road", start: "2024-11-14", end: "2025-03-15", x: 845, y: 335, impact: 64, disruption: "Drainage work + lane closure", color: "#93a46e" },
  { id: "BESCOM-090", name: "Koramangala Feeder Diversion", type: "Electrical", agency: "BESCOM", location: "80 Feet Road", road: "80 Feet Road", start: "2024-12-02", end: "2025-01-22", x: 845, y: 340, impact: 59, disruption: "Electrical work", color: "#dfc26a" },
  { id: "BBMP-241", name: "Cubbon Park Edge Mobility Works", type: "Roadworks", agency: "BBMP", location: "Kasturba Road", road: "Kasturba Road", start: "2024-06-27", end: "2024-09-29", x: 242, y: 220, impact: 38, disruption: "Road construction", color: "#d47f58" },
  { id: "BLR-044", name: "Airport Link Utility Shift", type: "Metro", agency: "BMRCL", location: "Hebbal Flyover", road: "Bellary Road", start: "2025-01-10", end: "2025-06-11", x: 350, y: 410, impact: 76, disruption: "Metro construction", color: "#c5a2c9" },
  { id: "JIO-062", name: "North Corridor Fiber Route", type: "Telecom", agency: "Jio Digital Life", location: "Bellary Road", road: "Bellary Road", start: "2025-02-05", end: "2025-04-16", x: 350, y: 414, impact: 41, disruption: "Telecom work", color: "#9d9bb8" },
  { id: "BW-133", name: "Ulsoor Lake Outfall Works", type: "Water", agency: "BWSSB", location: "Ulsoor", road: "Halasuru Road", start: "2024-08-14", end: "2024-11-28", x: 604, y: 72, impact: 33, disruption: "Water pipeline work", color: "#78a6a3" },
];

const filterOptions: FilterType[] = ["ALL", "Water", "Roadworks", "Metro", "Electrical", "Telecom", "Drainage", "Traffic", "Collisions"];

function dateOverlap(a: Project, b: Project) {
  return new Date(a.start) <= new Date(b.end) && new Date(b.start) <= new Date(a.end);
}

function spatialOverlap(a: Project, b: Project) {
  return Math.hypot(a.x - b.x, a.y - b.y) < 38;
}

function detectedCollisions(source: Project[] = projects) {
  return source.flatMap((project, index) => source.slice(index + 1).flatMap((other) => {
    if (!spatialOverlap(project, other) || !dateOverlap(project, other)) return [];
    const start = new Date(project.start) > new Date(other.start) ? project.start : other.start;
    const end = new Date(project.end) < new Date(other.end) ? project.end : other.end;
    return [{ id: `${project.id}-${other.id}`, projects: [project, other], road: project.road === other.road ? project.road : `${project.road} / ${other.road}`, start, end, spatial: `${Math.round(100 - Math.hypot(project.x - other.x, project.y - other.y) * 1.2)}m`, schedule: `${Math.max(1, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86400000))} days` }];
  }));
}

const collisions = detectedCollisions();

let currentDataset = projects;
let currentCollisions = collisions;
const datasetListeners = new Set<() => void>();
const subscribeDataset = (listener: () => void) => { datasetListeners.add(listener); return () => datasetListeners.delete(listener); };
const useDataset = () => useSyncExternalStore(subscribeDataset, () => currentDataset, () => projects);
function updateDataset(next: Project[]) {
  currentDataset = next;
  currentCollisions = detectedCollisions(next);
  datasetListeners.forEach((listener) => listener());
}

/**
 * The dataset currently being viewed. Uploading a file mints a new id
 * server-side; until then this stays on the seeded demo dataset.
 */
let currentDatasetId = "bengaluru-demo";
export const getDatasetId = () => currentDatasetId;
const setDatasetId = (id: string) => {
  currentDatasetId = id;
};

/**
 * Pulls the authoritative dataset from DynamoDB via the API. The records above
 * remain the fallback, so a cold or unreachable backend degrades to the
 * bundled demo data instead of an empty map.
 */
async function hydrateFromApi() {
  if (!API_ENABLED) return;
  try {
    const { datasetId, projects: remote } = await fetchProjects<Project>(currentDatasetId);
    if (remote?.length) {
      setDatasetId(datasetId);
      updateDataset(remote);
    }
  } catch (error) {
    console.warn("CrossCheck API unavailable, using bundled dataset.", error);
  }
}

type GeoPoint = { lat: number; lon: number; label: string };
type RouteStep = { instruction: string; distance: number };
type RouteOption = { id: string; label: string; distance: number; duration: number; geometry: [number, number][]; steps: RouteStep[]; disruptions: Project[]; start: GeoPoint; destination: GeoPoint };

async function geocodeLocation(query: string): Promise<GeoPoint> {
  const response = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=in&q=${encodeURIComponent(`${query}, Bengaluru, India`)}`, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error("geocode failed");
  const results = await response.json() as Array<{ lat: string; lon: string; display_name: string }>;
  if (!results[0]) throw new Error("location not found");
  return { lat: Number(results[0].lat), lon: Number(results[0].lon), label: results[0].display_name };
}

function routeDisruptions(geometry: [number, number][], source: Project[]) {
  return source.filter((project) => {
    const point = [12.9716 + (240 - project.y) / 2500, 77.5946 + (project.x - 500) / 2500];
    return geometry.some(([lon, lat]) => Math.hypot((lat - point[0]) * 85000, (lon - point[1]) * 100000) < 550);
  });
}

async function fetchRoutes(start: GeoPoint, destination: GeoPoint, source: Project[]): Promise<RouteOption[]> {
  const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${start.lon},${start.lat};${destination.lon},${destination.lat}?overview=full&geometries=geojson&steps=true&alternatives=true`);
  if (!response.ok) throw new Error("route failed");
  const payload = await response.json() as { routes?: Array<{ distance: number; duration: number; geometry: { coordinates: [number, number][] }; legs: Array<{ steps: Array<{ distance: number; maneuver: { instruction?: string; type: string; modifier?: string }; name?: string }> }> }> };
  if (!payload.routes?.length) throw new Error("no route");
  return payload.routes.map((route, index) => ({ id: `route-${index}`, label: index === 0 ? "Fastest Route" : `Alternative ${index}`, distance: route.distance, duration: route.duration, geometry: route.geometry.coordinates, steps: route.legs.flatMap((leg) => leg.steps.map((step) => ({ instruction: step.maneuver.instruction ?? `${step.maneuver.type} ${step.maneuver.modifier ?? ""} ${step.name ?? "road"}`.trim(), distance: step.distance }))), disruptions: routeDisruptions(route.geometry.coordinates, source), start, destination }));
}

function useReveal() {
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return { ref, visible };
}

function Reveal({
  children,
  className = "",
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const { ref, visible } = useReveal();
  return (
    <div
      ref={ref as RefObject<HTMLDivElement>}
      className={`reveal ${visible ? "is-visible" : ""} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

function Mark({ className = "" }: { className?: string }) {
  return (
    <span className={`brand-mark ${className}`} aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
  );
}

function SectionLabel({
  number,
  children,
  light = false,
}: {
  number: string;
  children: ReactNode;
  light?: boolean;
}) {
  return (
    <div className={`section-label ${light ? "section-label-light" : ""}`}>
      <span>{number}</span>
      <span>{children}</span>
    </div>
  );
}

function RoadNetwork({ compact = false }: { compact?: boolean }) {
  const [activeRoute, setActiveRoute] = useState("water");
  const routes = useMemo(
    () => [
      { id: "water", label: "Water", color: "#78a6a3", path: "M 15 79 C 170 68, 240 72, 360 49 S 590 25, 740 31" },
      { id: "electrical", label: "Electrical", color: "#dfc26a", path: "M 110 10 C 175 61, 214 91, 328 96 S 535 87, 690 86" },
      { id: "telecom", label: "Telecom", color: "#9d9bb8", path: "M 2 45 C 146 43, 198 41, 310 55 S 520 73, 735 69" },
      { id: "roadworks", label: "Roadworks", color: "#d47f58", path: "M 48 101 C 148 70, 232 25, 376 16 S 584 34, 742 100" },
    ],
    [],
  );

  return (
    <div className={`network-visual ${compact ? "network-visual-compact" : ""}`}>
      <div className="network-topbar">
        <span className="mono">CITY / BENGALURU / 12.9716° N, 77.5946° E</span>
        <span className="live-signal"><i /> live network</span>
      </div>
      <svg viewBox="0 0 760 120" role="img" aria-label="Infrastructure routes intersecting on a road network">
        <defs>
          <filter id="routeGlow">
            <feGaussianBlur stdDeviation="2.2" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse">
            <path d="M 32 0 L 0 0 0 32" fill="none" stroke="rgba(255,255,255,.08)" strokeWidth=".7" />
          </pattern>
        </defs>
        <rect width="760" height="120" fill="url(#grid)" />
        <path d="M 0 87 C 130 75 204 22 332 37 S 510 103 760 46" className="base-road" />
        <path d="M 0 87 C 130 75 204 22 332 37 S 510 103 760 46" className="base-road-inner" />
        {routes.map((route) => (
          <path
            key={route.id}
            d={route.path}
            className={`route route-${route.id} ${activeRoute === route.id ? "route-active" : ""}`}
            style={{ stroke: route.color }}
            filter={activeRoute === route.id ? "url(#routeGlow)" : undefined}
          />
        ))}
        <g className="collision-node">
          <circle cx="360" cy="49" r="16" />
          <circle cx="360" cy="49" r="5" />
          <path d="M360 23v-9M360 84v-9M334 49h-10M396 49h-10" />
        </g>
        <g className="map-pin pin-one"><circle cx="139" cy="38" r="3" /><path d="M139 33v-8h25" /></g>
        <g className="map-pin pin-two"><circle cx="604" cy="72" r="3" /><path d="M604 67v-9h38" /></g>
      </svg>
      <div className="route-legend">
        {routes.map((route) => (
          <button key={route.id} onClick={() => setActiveRoute(route.id)} className={activeRoute === route.id ? "active" : ""}>
            <i style={{ backgroundColor: route.color }} /> {route.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Hero() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const heading = "See the collisions before they happen.";

  useEffect(() => {
    const onMove = (event: MouseEvent) => {
      setMouse({ x: (event.clientX / window.innerWidth - 0.5) * 2, y: (event.clientY / window.innerHeight - 0.5) * 2 });
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  return (
    <section className="hero" id="top">
      <video className="hero-video" autoPlay loop muted playsInline src={VIDEO_SRC} />
      <div className="hero-chrome" aria-hidden="true"><span /><span /><span /></div>
      <nav className="floating-nav">
        <a href="#top" className="wordmark"><Mark /> CROSSCHECK</a>
        <div className="nav-links">
          {chapterLinks.map((link) => <a key={link.href} href={link.href}>{link.label}</a>)}
        </div>
        <a className="chat-link" href="mailto:hello@crosscheck.city">Start a Chat <ArrowUpRight size={14} /></a>
        <button className="menu-toggle" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle menu">
          {menuOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
      </nav>
      <div className={`mobile-menu ${menuOpen ? "open" : ""}`}>
        {chapterLinks.map((link) => <a key={link.href} href={link.href} onClick={() => setMenuOpen(false)}>{link.label}</a>)}
        <a href="mailto:hello@crosscheck.city">Start a Chat <ArrowUpRight size={14} /></a>
      </div>
      <div className="hero-coordinates mono"><span>12.9716° N</span><span>77.5946° E</span></div>
      <div className="hero-scan mono"><ScanLine size={13} /> infrastructure / scan 0048</div>
      <div className="hero-marker marker-a" style={{ transform: `translate(${mouse.x * 12}px, ${mouse.y * 8}px)` }}><span /><small>PROJECT_08 / ACTIVE</small></div>
      <div className="hero-marker marker-b" style={{ transform: `translate(${mouse.x * -8}px, ${mouse.y * -5}px)` }}><span /><small>ROAD_14 / 02.4 KM</small></div>
      <div className="hero-copy">
        <div className="eyebrow"><span className="eyebrow-line" /> infrastructure intelligence platform <span className="eyebrow-dot" /></div>
        <h1 aria-label={heading}>{heading.split(" ").map((word, index) => <span key={`${word}-${index}`}><span className="word-reveal" style={{ animationDelay: `${index * 55}ms` }}>{word}</span>{index < heading.split(" ").length - 1 ? " " : ""}</span>)}</h1>
        <p className="hero-subtitle">CrossCheck connects public works data to reveal where infrastructure projects collide, overlap, and waste resources.</p>
        <div className="hero-actions"><a className="button button-solid" href="#detect">Explore CrossCheck <ArrowDownRight size={15} /></a><a className="button button-ghost" href="#how-it-works">See How It Works <MoveRight size={15} /></a></div>
      </div>
      <div className="hero-footer"><div className="glass-pill"><span className="pulse-dot" /> Detect. CrossCheck. Prevent.</div><div className="scroll-cue"><span>Scroll to enter the network</span><ChevronDown size={15} /></div><span className="mono">CC / 001</span></div>
    </section>
  );
}

function StorySection() {
  const disruption = ["ROAD RESURFACED", "WATER WORK", "ELECTRICAL WORK", "TELECOM", "ROAD REPAIRED AGAIN"];
  return (
    <section className="story-section section-light" id="story">
      <div className="container story-grid">
        <Reveal className="story-intro"><SectionLabel number="01">The visibility gap</SectionLabel><h2>Cities don’t have a coordination problem.<br /><em>They have a visibility problem.</em></h2><p>Every project is rational in isolation. The waste starts in the gaps between them when no one can see what is already planned for the same road.</p><a href="#detect" className="text-link">Understand the collision <MoveRight size={16} /></a></Reveal>
        <Reveal className="disruption-track" delay={120}>
          <div className="track-header"><span>ONE ROAD / FIVE INTERRUPTIONS</span><span className="mono">2018 — 2024</span></div>
          <div className="track-line">{disruption.map((item, index) => <div className={`track-item ${index === 4 ? "track-end" : ""}`} key={item}><span className="track-dot" /><span>{item}</span>{index < disruption.length - 1 && <span className="track-arrow">↓</span>}</div>)}</div>
        </Reveal>
      </div>
    </section>
  );
}

function CollisionSection() {
  return (
    <section className="collision-section section-dark" id="detect">
      <div className="container">
        <div className="section-head split-head"><Reveal><SectionLabel number="02" light>Cross-checking the city</SectionLabel><h2>See where<br /><span>intent collides.</span></h2></Reveal><Reveal delay={120} className="head-aside"><p>CrossCheck turns fragmented public works records into a single, living view of the road ahead.</p><div className="mini-status"><Radio size={14} /> detecting across 4 layers</div></Reveal></div>
        <Reveal delay={160} className="collision-stage">
          <div className="stage-meta left-meta mono"><span>ROUTE ANALYSIS</span><span>LIVE / 0048</span></div>
          <RoadNetwork />
          <div className="collision-card"><div className="card-kicker"><span className="pulse-dot pulse-dot-warm" /> collision detected</div><div className="card-title">3 projects overlap</div><div className="card-stats"><div><strong>180</strong><span>days</span></div><div><strong>420</strong><span>m affected</span></div><div><strong>03</strong><span>agencies</span></div></div><a href="#network" className="card-link">View route intelligence <ArrowUpRight size={14} /></a></div>
          <div className="stage-meta right-meta mono"><span>+12.9716, +77.5946</span><span>09:41:28 IST</span></div>
        </Reveal>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    { number: "01", title: "Collect", copy: "Public infrastructure and tender data.", icon: <Layers3 size={18} /> },
    { number: "02", title: "Normalize", copy: "Turn fragmented information into structured project data.", icon: <ScanLine size={18} /> },
    { number: "03", title: "Cross-check", copy: "Compare projects by location and time.", icon: <Crosshair size={18} /> },
    { number: "04", title: "Act", copy: "Identify potential collisions before work begins.", icon: <Check size={18} /> },
  ];
  return (
    <section className="how-section section-light" id="how-it-works">
      <div className="container"><div className="section-head how-head"><Reveal><SectionLabel number="03">From noise to foresight</SectionLabel><h2>One city.<br /><em>Four clear moves.</em></h2></Reveal><Reveal delay={100} className="how-copy"><p>The system behind CrossCheck is intentionally simple: collect what exists, make it legible, and surface the moments that matter.</p></Reveal></div>
        <div className="steps-row">{steps.map((step, index) => <Reveal key={step.number} delay={index * 70} className="step"><div className="step-icon">{step.icon}</div><span className="step-number mono">{step.number}</span><h3>{step.title}</h3><p>{step.copy}</p>{index < steps.length - 1 && <div className="step-connector"><MoveRight size={16} /></div>}</Reveal>)}</div>
      </div>
    </section>
  );
}

function LiveCity() {
  const [activeFilter, setActiveFilter] = useState("all");
  const filters = ["all", "water", "electrical", "telecom", "roadworks"];
  return (
    <section className="live-section section-dark" id="network">
      <div className="container"><div className="live-header"><Reveal><SectionLabel number="04" light>Operating view / beta</SectionLabel><h2>Look inside<br /><span>the living city.</span></h2></Reveal><Reveal delay={100} className="live-description"><p>A demo view of Bengaluru's road network, assembled from the signals that usually stay buried in separate systems.</p><span className="demo-label"><i /> demo data / not live</span></Reveal></div>
        <Reveal delay={150} className="city-map"><div className="map-top"><div className="map-title"><Eye size={15} /> city network / bengaluru</div><div className="map-tools"><span className="mono">zoom 14.2</span><button aria-label="Zoom out"><Minus size={14} /></button><button aria-label="Zoom in">+</button></div></div><div className="map-canvas"><svg viewBox="0 0 1000 500" preserveAspectRatio="none" aria-label="Fictional Bengaluru road network map"><defs><pattern id="citygrid" width="44" height="44" patternUnits="userSpaceOnUse"><path d="M44 0H0V44" fill="none" stroke="#ffffff" strokeOpacity=".055" /></pattern><filter id="glow"><feGaussianBlur stdDeviation="4" /></filter></defs><rect width="1000" height="500" fill="url(#citygrid)" /><g className="city-roads"><path d="M-20 180 C 180 120 260 235 410 160 S 690 50 1040 130" /><path d="M-20 350 C 130 270 240 315 360 350 S 700 380 1040 260" /><path d="M120 -20 C 180 130 140 230 250 520" /><path d="M350 -20 C 330 120 500 170 470 520" /><path d="M620 -20 C 580 120 750 190 710 520" /><path d="M820 -20 C 790 150 890 270 960 520" /></g><g className="city-secondary"><path d="M0 260L1000 210" /><path d="M70 500L540 0" /><path d="M540 500L930 0" /><path d="M0 78L1000 430" /></g><g className="city-routes"><path d="M80 438 C 230 300 275 210 425 235 S 700 330 905 92" className="city-water" /><path d="M95 72 C 265 250 340 300 515 198 S 745 125 916 388" className="city-electrical" /><path d="M30 280 C 220 260 340 260 500 285 S 760 360 980 300" className="city-telecom" /></g><g className="city-collisions"><circle cx="425" cy="235" r="19" /><circle cx="425" cy="235" r="5" /><circle cx="650" cy="288" r="19" /><circle cx="650" cy="288" r="5" /><circle cx="515" cy="198" r="13" /><circle cx="515" cy="198" r="4" /></g><g className="construction-markers"><path d="M242 220l7 12h-14z" /><path d="M760 180l7 12h-14z" /><path d="M845 335l7 12h-14z" /><path d="M350 410l7 12h-14z" /></g></svg><div className="map-label label-1">RICHMOND RD <span>01</span></div><div className="map-label label-2">INDIRANAGAR <span>04</span></div><div className="map-label label-3">MG ROAD <span>02</span></div><div className="map-crosshair"><span /><span /></div></div><div className="map-bottom"><div className="filter-list">{filters.map((filter) => <button onClick={() => setActiveFilter(filter)} className={activeFilter === filter ? "active" : ""} key={filter}><i className={`filter-dot ${filter}`} />{filter}</button>)}</div><div className="map-readout mono"><span>routes indexed <b>18,402</b></span><span>collision points <b>03</b></span></div></div></Reveal>
      </div>
    </section>
  );
}

function LeafletCityMap({
  data,
  collisionData,
  layers,
  routeResult,
  onProject,
  onCollision,
  onTraffic,
}: {
  data: Project[];
  collisionData: ReturnType<typeof detectedCollisions>;
  layers: string[];
  routeResult: RouteOption | null;
  onProject: (project: Project) => void;
  onCollision: (collision: ReturnType<typeof detectedCollisions>[number]) => void;
  onTraffic: (project: Project) => void;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;
    let fitFrame = 0;
    host.replaceChildren();
    const map = L.map(host, { zoomControl: false, scrollWheelZoom: true, zoomAnimation: false, fadeAnimation: false, markerZoomAnimation: false }).setView([12.9716, 77.5946], 12, { animate: false });
    L.control.zoom({ position: "bottomright" }).addTo(map);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap · DEMO MAP DATA" }).addTo(map);
    const toLatLng = (project: Project): [number, number] => [12.9716 + (240 - project.y) / 2500, 77.5946 + (project.x - 500) / 2500];
    const routePoints = (project: Project): [number, number][] => { const center = toLatLng(project); return [[center[0] - .006, center[1] - .008], [center[0] - .002, center[1] - .002], center, [center[0] + .002, center[1] + .004], [center[0] + .005, center[1] + .008]]; };
    const routeGroup = L.layerGroup().addTo(map);
    if (routeResult) {
      const routeShape = routeResult.geometry.map(([lon, lat]) => [lat, lon] as [number, number]);
      L.polyline(routeShape, { color: "#f4edbe", weight: 6, opacity: .98, lineCap: "round" }).bindTooltip(`${routeResult.label} · ${(routeResult.distance / 1000).toFixed(1)} km`).addTo(routeGroup);
      L.marker([routeResult.start.lat, routeResult.start.lon]).bindTooltip(`START · ${routeResult.start.label}`).addTo(routeGroup);
      L.marker([routeResult.destination.lat, routeResult.destination.lon]).bindTooltip(`DESTINATION · ${routeResult.destination.label}`).addTo(routeGroup);
      if (routeShape.length > 1) {
        fitFrame = window.requestAnimationFrame(() => {
          if (!disposed && host.isConnected && map.getContainer().isConnected) map.fitBounds(L.latLngBounds(routeShape), { padding: [28, 28], animate: false });
        });
      }
    }
    if (layers.includes("Construction")) data.forEach((project) => L.polyline(routePoints(project), { color: project.color, weight: 3, opacity: .72, dashArray: "8 7" }).bindTooltip(`${project.type} · ${project.road}`).addTo(routeGroup));
    if (layers.includes("Projects")) data.forEach((project) => L.circleMarker(toLatLng(project), { radius: 6, color: project.color, fillColor: project.color, fillOpacity: .95, weight: 2 }).on("click", () => onProject(project)).bindTooltip(project.name).addTo(routeGroup));
    if (layers.includes("Traffic")) data.filter((project) => project.impact > 65).forEach((project) => L.circleMarker(toLatLng(project), { radius: 11, color: "#e4bd73", fillColor: "#e4bd73", fillOpacity: .12, weight: 1, className: "leaflet-traffic-pulse" }).on("click", () => onTraffic(project)).bindTooltip(`Traffic · ${project.road}`).addTo(routeGroup));
    if (layers.includes("Collisions")) collisionData.forEach((collision, index) => { const center = toLatLng(collision.projects[0]); L.circleMarker([center[0] + index * .002, center[1] + index * .003], { radius: 10, color: "#d6c87c", fillColor: "#d6c87c", fillOpacity: .72, weight: 2 }).on("click", () => onCollision(collision)).bindTooltip(`Collision detected · ${collision.road}`).addTo(routeGroup); });
    return () => {
      disposed = true;
      if (fitFrame) window.cancelAnimationFrame(fitFrame);
      map.stop();
      map.off();
      routeGroup.clearLayers();
      map.remove();
    };
  }, [data, collisionData, layers, routeResult, onProject, onCollision, onTraffic]);
  return <div ref={hostRef} className="leaflet-map-host" aria-label="Interactive Bengaluru Leaflet map" style={{ backgroundColor: "#000000" }} />;
}

function LiveCityInteractive() {
  const data = useDataset();
  const liveCollisions = useMemo(() => detectedCollisions(data), [data]);
  const [activeFilters, setActiveFilters] = useState<FilterType[]>(["ALL"]);
  const [layers, setLayers] = useState(["Traffic", "Construction", "Projects", "Collisions", "Road closures"]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [selectedCollision, setSelectedCollision] = useState<(typeof collisions)[number] | null>(liveCollisions[0] ?? null);
  const [start, setStart] = useState("Indiranagar");
  const [destination, setDestination] = useState("MG Road");
  const [routeChoice, setRouteChoice] = useState("smart");
  const [routeOptions, setRouteOptions] = useState<RouteOption[]>([]);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState("");
  const [zoom, setZoom] = useState(1);
  const [mapOffset, setMapOffset] = useState({ x: 0, y: 0 });
  const [search, setSearch] = useState("");
  const [aiInput, setAiInput] = useState("");
  const [aiResponse, setAiResponse] = useState("Ask about a route, collision, project, or traffic cause.");

  const visibleProjects = data.filter((project) => (activeFilters.includes("ALL") || activeFilters.includes(project.type)) && (!search || `${project.name} ${project.location} ${project.agency} ${project.road}`.toLowerCase().includes(search.toLowerCase())));
  const selectedRoute = routeOptions.find((route) => route.id === routeChoice) ?? routeOptions[0] ?? null;
  const planRoute = async () => {
    setRouteLoading(true); setRouteError("");
    try { const [startPoint, destinationPoint] = await Promise.all([geocodeLocation(start), geocodeLocation(destination)]); const routes = await fetchRoutes(startPoint, destinationPoint, data); setRouteOptions(routes); setRouteChoice(routes.slice().sort((a, b) => a.disruptions.length - b.disruptions.length)[0]?.id ?? routes[0].id); }
    catch { setRouteOptions([]); setRouteError("Route unavailable. Check the location names and try again."); }
    finally { setRouteLoading(false); }
  };

  const toggleFilter = (filter: FilterType) => setActiveFilters((current) => filter === "ALL" ? (current.includes("ALL") ? [] : ["ALL"]) : current.includes("ALL") ? [filter] : current.includes(filter) ? current.filter((item) => item !== filter) : [...current, filter]);
  const toggleLayer = (layer: string) => setLayers((current) => current.includes(layer) ? current.filter((item) => item !== layer) : [...current, layer]);
  const askAI = async () => {
    const question = aiInput.trim();
    if (!question) return;

    // Preferred path: Bedrock, grounded in the dataset by the assistant Lambda.
    if (API_ENABLED) {
      setAiResponse("Analysing the dataset…");
      try {
        const { answer } = await askAssistant(question, getDatasetId());
        if (answer) {
          setAiResponse(answer);
          return;
        }
      } catch (error) {
        console.warn("Assistant API unavailable, answering locally.", error);
      }
    }

    const prompt = aiInput.toLowerCase();
    if (prompt.includes("traffic") || prompt.includes("slow")) { const trafficProject = data.find((project) => project.impact > 65) ?? data[0]; setAiResponse(`DEMO AI FALLBACK: ${trafficProject?.road ?? "the selected road"} is affected by ${trafficProject?.disruption ?? "active infrastructure work"}. Estimated impact is ${trafficProject?.impact ?? 0}/100 using the current synthetic dataset.`); }
    else if (prompt.includes("route") || prompt.includes("construction")) setAiResponse(`DEMO AI FALLBACK: CrossCheck selected the Smart Route because the current dataset contains ${liveCollisions.length} computed collision windows and avoids ${Math.max(1, liveCollisions.length - 1)} disruption zones.`);
    else if (prompt.includes("agency") || prompt.includes("agencies")) setAiResponse(`DEMO AI FALLBACK: ${new Set(data.map((project) => project.agency)).size} agencies are represented in the current dataset: ${Array.from(new Set(data.map((project) => project.agency))).join(", ")}.`);
    else if (prompt.includes("collision") || prompt.includes("overlap")) setAiResponse(`DEMO AI FALLBACK: ${liveCollisions.length} collisions were calculated from route proximity plus date overlap. ${liveCollisions[0] ? `${liveCollisions[0].road} is the highest-priority detected window.` : "No collision is currently detected."}`);
    else setAiResponse(`DEMO AI FALLBACK: CrossCheck analyzed ${data.length} synthetic projects and found ${liveCollisions.length} computed collision windows. Ask about traffic, routes, agencies, or overlap.`);
  };
  const handleUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const raw = String(reader.result ?? "");

      // Preferred path: the API archives the raw file to S3, stores the
      // normalised rows in DynamoDB, and returns recomputed collisions.
      if (API_ENABLED) {
        try {
          const result = await uploadDataset<Project, typeof collisions[number]>(file.name, raw);
          setDatasetId(result.datasetId);
          updateDataset(result.projects);
          setSelectedCollision(detectedCollisions(result.projects)[0] ?? null);
          setAiResponse(`Uploaded ${result.accepted} valid project records. Collisions recalculated server-side.`);
          return;
        } catch (error) {
          console.warn("Upload API unavailable, parsing locally.", error);
        }
      }

      // Fallback: parse in the browser so the demo still works offline.
      try {
        const text = raw;
        const parsed = file.name.endsWith(".json") ? JSON.parse(text) : text.trim().split(/\r?\n/).slice(1).map((row) => { const [name, agency, type, startDate, endDate, location, road] = row.split(",").map((value) => value.trim()); return { name, agency, type, start: startDate, end: endDate, location, road }; });
        const rows = Array.isArray(parsed) ? parsed : parsed.projects;
        const normalized = rows.map((row: Record<string, string>, index: number) => ({ id: row.id ?? `UPLOAD-${index + 1}`, name: row.name ?? row.projectName, type: row.type ?? row.category, agency: row.agency, location: row.location ?? "Bengaluru", road: row.road ?? row.location ?? "Demo Road", start: row.start ?? row.startDate, end: row.end ?? row.endDate, x: Number(row.x ?? 300 + index * 37), y: Number(row.y ?? 180 + index * 23), impact: Number(row.impact ?? 50), disruption: row.disruption ?? `${row.type ?? row.category} work`, color: row.color ?? "#d6c87c" })).filter((row: Project) => row.name && row.agency && row.type && row.start && row.end && row.location);
        if (normalized.length) { updateDataset(normalized as Project[]); setSelectedCollision(detectedCollisions(normalized as Project[])[0] ?? null); setAiResponse(`DEMO AI FALLBACK: Uploaded ${normalized.length} valid project records and recalculated collisions.`); }
      } catch { setAiResponse("DEMO AI FALLBACK: Upload failed validation. Use JSON or CSV with name, agency, category/type, start, end, and location fields."); }
    };
    reader.readAsText(file);
  };
  const downloadBrief = () => {
    if (!selectedCollision) return;
    const brief = [`CROSSCHECK COLLISION BRIEF`, `Collision ID: ${selectedCollision.id}`, `Location: ${selectedCollision.road}`, `Projects: ${selectedCollision.projects.map((project) => project.name).join("; ")}`, `Agencies: ${selectedCollision.projects.map((project) => project.agency).join("; ")}`, `Spatial overlap: ${selectedCollision.spatial}`, `Schedule overlap: ${selectedCollision.schedule}`, `Intervention window: ${selectedCollision.start} → ${selectedCollision.end}`, `Risk: ${Number.parseInt(selectedCollision.schedule, 10) > 60 ? "HIGH" : "MEDIUM"}`, `Recommended coordination: sequence utility works before resurfacing, align lane closures, and publish one shared public notice.`].join("\n");
    const url = URL.createObjectURL(new Blob([brief], { type: "text/plain" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${selectedCollision.id}-collision-brief.txt`; anchor.click(); URL.revokeObjectURL(url);
  };

  return (
    <section className="live-section section-dark" id="network">
      <div className="container">
        <div className="live-header"><Reveal><SectionLabel number="04" light>Operating view / beta</SectionLabel><h2>Look inside<br /><span>the living city.</span></h2></Reveal><Reveal delay={100} className="live-description"><p>A demo view of Bengaluru's road network, assembled from the signals that usually stay buried in separate systems.</p><span className="demo-label"><i /> demo data / synthetic project records</span></Reveal></div>
        <Reveal delay={150} className="city-intelligence">
          <div className="console-toolbar"><div className="map-title"><Eye size={15} /> city network / bengaluru</div><div className="demo-badge"><AlertTriangle size={12} /> DEMO TRAFFIC DATA</div><div className="map-tools"><span className="mono">zoom {zoom.toFixed(1)}</span><button aria-label="Zoom out" onClick={() => setZoom((value) => Math.max(.8, value - .2))}><Minus size={14} /></button><button aria-label="Zoom in" onClick={() => setZoom((value) => Math.min(1.8, value + .2))}>+</button></div></div>
          <div className="console-body">
            <div className="map-canvas interactive-canvas"><LeafletCityMap data={visibleProjects} collisionData={liveCollisions} layers={layers} routeResult={selectedRoute} onProject={(project) => { setSelectedProject(project); setSelectedCollision(null); }} onCollision={(collision) => { setSelectedCollision(collision); setSelectedProject(null); }} onTraffic={(project) => { setSelectedProject(project); setSelectedCollision(null); }} />
              <svg viewBox="0 0 1000 500" preserveAspectRatio="none" aria-label="Interactive fictional Bengaluru infrastructure map"><defs><pattern id="citygrid2" width="44" height="44" patternUnits="userSpaceOnUse"><path d="M44 0H0V44" fill="none" stroke="#ffffff" strokeOpacity=".055" /></pattern></defs><rect width="1000" height="500" fill="url(#citygrid2)" /><g transform={`translate(${mapOffset.x} ${mapOffset.y}) scale(${zoom})`}><g className="city-roads"><path d="M-20 180 C 180 120 260 235 410 160 S 690 50 1040 130" /><path d="M-20 350 C 130 270 240 315 360 350 S 700 380 1040 260" /><path d="M120 -20 C 180 130 140 230 250 520" /><path d="M350 -20 C 330 120 500 170 470 520" /><path d="M620 -20 C 580 120 750 190 710 520" /><path d="M820 -20 C 790 150 890 270 960 520" /></g><g className="city-secondary"><path d="M0 260L1000 210" /><path d="M70 500L540 0" /><path d="M540 500L930 0" /><path d="M0 78L1000 430" /></g>{layers.includes("Construction") && <g className="city-routes"><path d="M80 438 C 230 300 275 210 425 235 S 700 330 905 92" className="city-water" /><path d="M95 72 C 265 250 340 300 515 198 S 745 125 916 388" className="city-electrical" /><path d="M30 280 C 220 260 340 260 500 285 S 760 360 980 300" className="city-telecom" /></g>}{layers.includes("Traffic") && <g className="traffic-lines"><path d="M0 282 C 220 260 340 260 500 285 S 760 360 1000 300" /><path d="M170 115 C 250 155 320 178 420 155" /></g>}{layers.includes("Collisions") && <g className="city-collisions">{collisions.map((collision, index) => <g key={collision.id} className="clickable-marker" onClick={() => { setSelectedCollision(collision); setSelectedProject(null); }}><circle cx={index === 0 ? 425 : index === 1 ? 650 : 515} cy={index === 0 ? 235 : index === 1 ? 288 : 198} r="19" /><circle cx={index === 0 ? 425 : index === 1 ? 650 : 515} cy={index === 0 ? 235 : index === 1 ? 288 : 198} r="5" /></g>)}</g>}{layers.includes("Projects") && <g className="project-markers">{visibleProjects.map((project) => <g key={project.id} className="clickable-marker" onClick={() => { setSelectedProject(project); setSelectedCollision(null); }}><circle cx={project.x} cy={project.y} r="6" fill={project.color} /><circle cx={project.x} cy={project.y} r="10" fill="none" stroke={project.color} strokeOpacity=".35" /></g>)}</g>}{layers.includes("Road closures") && <g className="closure-marks"><path d="M400 208l20 20m0-20l-20 20" /><path d="M640 260l20 20m0-20l-20 20" /></g>}<path d={""} className="selected-route" /></g></svg>
              <div className="map-label label-1">RICHMOND RD <span>01</span></div><div className="map-label label-2">INDIRANAGAR <span>04</span></div><div className="map-label label-3">MG ROAD <span>02</span></div><div className="map-crosshair"><span /><span /></div>
              <div className="map-pan"><button onClick={() => setMapOffset((current) => ({ ...current, y: current.y + 12 }))}>↑</button><div><button onClick={() => setMapOffset((current) => ({ ...current, x: current.x - 12 }))}>←</button><button onClick={() => setMapOffset((current) => ({ ...current, x: current.x + 12 }))}>→</button></div><button onClick={() => setMapOffset((current) => ({ ...current, y: current.y - 12 }))}>↓</button></div>
            </div>
            <aside className="console-side"><div className="side-search"><Search size={14} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search projects, roads..." /></div><label className="upload-control"><Upload size={13} /><span>Upload JSON / CSV dataset</span><input type="file" accept=".json,.csv,application/json,text/csv" onChange={handleUpload} /></label><div className="side-block"><div className="side-heading">Infrastructure filters <span className="mono">{activeFilters.includes("ALL") ? "ALL" : `${activeFilters.length}/8`}</span></div><div className="filter-list filter-list-console">{filterOptions.map((filter) => <button onClick={() => toggleFilter(filter)} className={activeFilters.includes(filter) ? "active" : ""} key={filter}><i className={`filter-dot ${filter.toLowerCase()}`} />{filter}</button>)}</div></div><div className="side-block"><div className="side-heading">Layers <span className="mono">toggle</span></div><div className="layer-list">{["Traffic", "Construction", "Projects", "Collisions", "Road closures"].map((layer) => <button key={layer} onClick={() => toggleLayer(layer)} className={layers.includes(layer) ? "active" : ""}><span>{layers.includes(layer) ? "ON" : "OFF"}</span>{layer}</button>)}</div></div><div className="side-foot mono"><span>projects indexed <b>{projects.length}</b></span><span>collisions detected <b>{collisions.length}</b></span></div></aside>
          </div>
          <div className="route-planner"><div className="route-planner-head"><div><Navigation size={14} /> start → destination routing</div><span className="demo-label"><i /> OpenStreetMap / OSRM routing</span></div><div className="route-inputs"><label><MapPin size={14} /><input value={start} onChange={(event) => setStart(event.target.value)} aria-label="Start point" placeholder="START POINT" /></label><MoveRight size={16} className="route-arrow" /><label><MapPin size={14} /><input value={destination} onChange={(event) => setDestination(event.target.value)} aria-label="Destination" placeholder="DESTINATION" /></label><button className="route-generate" onClick={planRoute} disabled={routeLoading}>{routeLoading ? "Finding route…" : <>Plan route <ArrowUpRight size={14} /></>}</button></div>{routeError && <div className="route-error">{routeError}</div>}{routeOptions.length > 0 && <><div className="route-options">{routeOptions.map((route, index) => <button key={route.id} onClick={() => setRouteChoice(route.id)} className={selectedRoute?.id === route.id ? "active" : ""}><span>{index === 0 ? "Fastest Route" : `Alternative ${index}`}</span><b>{(route.distance / 1000).toFixed(1)} km · {Math.round(route.duration / 60)} min</b><small>{route.disruptions.length} CrossCheck disruptions</small></button>)}</div><div className="smart-explanation"><div><Check size={14} /> <strong>{selectedRoute?.label}</strong><span>{start} → {destination}</span></div><p>{selectedRoute && selectedRoute.disruptions.length === Math.min(...routeOptions.map((route) => route.disruptions.length)) ? "CrossCheck selected the route with the fewest detected infrastructure disruptions based on the current project dataset." : "This route follows the live OSRM result; CrossCheck detected infrastructure zones along its actual geometry."}</p><div className="route-compare mono"><span>selected <b>{selectedRoute?.disruptions.length ?? 0} disruptions</b></span><span>roads checked <b>{selectedRoute?.geometry.length ?? 0} points</b></span><span>route source <b>OSRM</b></span></div></div><div className="directions-panel"><div className="directions-title"><Navigation size={14} /> turn-by-turn directions <span>{selectedRoute?.steps.length ?? 0} steps</span></div><div className="directions-list"><div className="direction-start"><MapPin size={13} /> START · {selectedRoute?.start.label}</div>{selectedRoute?.steps.slice(0, 8).map((step, index) => <div className="direction-step" key={`${step.instruction}-${index}`}><MoveRight size={12} /><span>{step.instruction}</span><small>{step.distance >= 1000 ? `${(step.distance / 1000).toFixed(1)} km` : `${Math.round(step.distance)} m`}</small></div>)}<div className="direction-start"><MapPin size={13} /> DESTINATION · {selectedRoute?.destination.label}</div></div></div><div className="disruption-list"><div className="directions-title"><AlertTriangle size={14} /> {selectedRoute?.disruptions.length ?? 0} CrossCheck disruptions</div>{selectedRoute?.disruptions.map((project) => <button key={project.id} onClick={() => { setSelectedProject(project); setSelectedCollision(null); }}><span>{project.road} — {project.name}</span><ArrowUpRight size={12} /></button>)}</div></>}</div>
          <div className="intelligence-panels">{selectedProject && <div className="detail-panel"><div className="panel-kicker"><span className="pulse-dot" /> project intelligence</div><button className="panel-close" onClick={() => setSelectedProject(null)}><X size={15} /></button><h3>{selectedProject.name}</h3><div className="panel-meta"><span>{selectedProject.type} · {selectedProject.agency}</span><span>{selectedProject.location}</span></div><div className="project-details"><div><small>STATUS</small><b>Active work</b></div><div><small>SCHEDULE</small><b>{selectedProject.start} → {selectedProject.end}</b></div><div><small>TRAFFIC IMPACT</small><b>{selectedProject.impact}/100</b></div><div><small>NEARBY PROJECTS</small><b>{projects.filter((project) => project.id !== selectedProject.id && spatialOverlap(project, selectedProject)).length} found</b></div></div><div className="impact-breakdown"><div className="side-heading">Why is traffic slow? <span>DEMO TRAFFIC DATA</span></div><p>{selectedProject.disruption}. This project's active period affects {selectedProject.road}.</p><div className="impact-bar"><span style={{ width: `${selectedProject.impact}%`, background: selectedProject.color }} /></div></div></div>}{selectedCollision && <div className="detail-panel collision-panel"><div className="panel-kicker"><span className="pulse-dot pulse-dot-warm" /> collision brief</div><button className="panel-close" onClick={() => setSelectedCollision(null)}><X size={15} /></button><h3>{selectedCollision.road}</h3><p className="panel-lede">Flagged because the projects overlap geographically and their active schedules intersect.</p><div className="collision-projects">{selectedCollision.projects.map((project) => <button key={project.id} onClick={() => { setSelectedProject(project); setSelectedCollision(null); }}><i style={{ background: project.color }} /><span><b>{project.name}</b><small>{project.agency} · {project.type}</small></span><ArrowUpRight size={13} /></button>)}</div><div className="collision-facts"><div><small>SPATIAL OVERLAP</small><b>{selectedCollision.spatial}</b></div><div><small>SCHEDULE OVERLAP</small><b>{selectedCollision.schedule}</b></div><div><small>COLLISION WINDOW</small><b>{selectedCollision.start} → {selectedCollision.end}</b></div></div><div className="collision-timeline"><span className="timeline-base" /><span className="timeline-overlap" /><small>project schedules / overlap window</small></div><div className="panel-actions"><button onClick={() => document.querySelector(".interactive-canvas")?.scrollIntoView({ behavior: "smooth", block: "center" })}>View on map <Eye size={13} /></button><button onClick={() => setAiResponse("DEMO AI MODE: Coordinate a shared lane closure window, sequence the water work before resurfacing, and publish one public notice for Richmond Road.")}>Generate coordination brief <ArrowUpRight size={13} /></button><button onClick={downloadBrief}>Download brief <Upload size={13} /></button></div></div>}</div>
          <div className="ai-assistant"><div className="ai-title"><Bot size={16} /><span>Ask CrossCheck AI</span><small>DEMO AI MODE</small></div><div className="ai-form"><input value={aiInput} onChange={(event) => setAiInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") askAI(); }} placeholder="Why is traffic slow here?" /><button onClick={askAI}><ArrowUpRight size={15} /></button></div><p>{aiResponse}</p></div>
        </Reveal>
      </div>
    </section>
  );
}

function CivicIntelligence({ data, collisionData }: { data: Project[]; collisionData: ReturnType<typeof detectedCollisions> }) {
  const [rupees, setRupees] = useState(0);
  const [groundTruth, setGroundTruth] = useState(false);
  const [copied, setCopied] = useState(false);
  const overlapMeters = collisionData.reduce((total, collision) => total + Number.parseInt(collision.spatial, 10), 0);
  const avoidableCrore = (overlapMeters / 1000) * 1.25 + collisionData.length * .4;
  const wards = Array.from(new Set(data.map((project) => project.location.split(" ").slice(-1)[0]))).map((ward) => {
    const wardProjects = data.filter((project) => project.location.includes(ward));
    const overlapCount = collisionData.filter((collision) => collision.projects.some((project) => project.location.includes(ward))).length;
    return { ward, score: Math.min(99, Math.round((overlapCount / Math.max(1, wardProjects.length)) * 100)), projects: wardProjects.length };
  }).sort((a, b) => b.score - a.score).slice(0, 4);
  const forecast = data.filter((project) => !collisionData.some((collision) => collision.projects.some((item) => item.id === project.id))).sort((a, b) => b.impact - a.impact).slice(0, 3);
  useEffect(() => { let frame = 0; const target = Math.round(avoidableCrore * 100) / 100; const timer = window.setInterval(() => { frame += Math.max(.1, target / 20); setRupees(Math.min(target, Number(frame.toFixed(2)))); if (frame >= target) window.clearInterval(timer); }, 45); return () => window.clearInterval(timer); }, [avoidableCrore]);
  const downloadRTI = (collision: ReturnType<typeof detectedCollisions>[number]) => { const body = `To: ${collision.projects.map((project) => project.agency).join(" and ")}\\nSubject: Request for coordination records — ${collision.road}\\n\\nPlease clarify how ${collision.projects.map((project) => project.name).join(" and ")} were scheduled concurrently between ${collision.start} and ${collision.end}. CrossCheck detected ${collision.spatial} spatial proximity and ${collision.schedule} schedule overlap in synthetic demo data. Please provide the coordination record, traffic management plan, and intervention window.`; const url = URL.createObjectURL(new Blob([body], { type: "text/plain" })); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${collision.id}-RTI-draft.txt`; anchor.click(); URL.revokeObjectURL(url); };
  const widgetCode = `<iframe src="crosscheck.city/widget/bengaluru" width="420" height="260" title="CrossCheck collisions"></iframe>`;
  return <section className="civic-section section-light"><div className="container"><Reveal><SectionLabel number="05">From detection to action</SectionLabel><div className="civic-heading"><h2>Make the cost<br /><em>impossible to ignore.</em></h2><p>Every output below is calculated from the current synthetic project records. <span className="demo-label"><i /> DEMO MODE</span></p></div></Reveal><div className="civic-grid"><Reveal className="rupee-card"><div className="civic-kicker"><TrendingUp size={15} /> avoidable re-work detected</div><div className="rupee-value">₹{rupees.toFixed(2)} <small>Cr</small></div><p>Estimated using ₹1.25 Cr per km of resurfacing plus overlap coordination cost.</p><span className="civic-note">Across {Math.max(1, wards.length)} demo wards · updates with dataset</span></Reveal><Reveal delay={80} className="score-card"><div className="civic-kicker"><Trophy size={15} /> civic coordination score</div><div className="score-list">{wards.map((item, index) => <div className="score-row" key={item.ward}><span className="score-rank">0{index + 1}</span><span className="score-name">{item.ward}<small>{item.projects} projects</small></span><div className="score-bar"><i style={{ width: `${Math.max(10, item.score)}%` }} /></div><b>{item.score}</b></div>)}</div></Reveal></div><div className="civic-grid civic-grid-lower"><Reveal className="ground-card"><div className="civic-kicker"><Camera size={15} /> citizen ground-truth</div><h3>See a dig-up that isn't in the records?</h3><p>Upload a photo and pin reality against document-derived detections.</p><label className="citizen-upload"><Camera size={14} /> {groundTruth ? "Photo pinned · DEMO REPORT" : "Upload site photo"}<input type="file" accept="image/*" onChange={() => setGroundTruth(true)} /></label>{groundTruth && <span className="ground-success">● Pin queued for Richmond Road verification</span>}</Reveal><Reveal delay={80} className="forecast-card"><div className="civic-kicker"><CalendarDays size={15} /> next likely collision</div><h3>Explainable forecast</h3><p>High-impact segments with no current collision, ranked for future re-dig risk.</p>{forecast.map((project) => <div className="forecast-row" key={project.id}><span>{project.road}</span><b>{project.impact}%</b><small>{project.agency} · watch next 90 days</small></div>)}</Reveal></div><div className="civic-grid civic-grid-actions"><Reveal className="rti-card"><div className="civic-kicker"><FileText size={15} /> turn a finding into action</div><h3>Auto-generate an RTI / complaint draft</h3><p>Uses the actual detected collision records and involved agencies.</p>{collisionData.slice(0, 2).map((collision) => <button key={collision.id} onClick={() => downloadRTI(collision)}>{collision.road}<span>Download draft <FileText size={13} /></span></button>)}</Reveal><Reveal delay={80} className="embed-card"><div className="civic-kicker"><Copy size={15} /> public distribution</div><h3>Embed collision intelligence</h3><p>A compact widget for local newsrooms and citizen blogs.</p><code>{widgetCode}</code><button onClick={() => { navigator.clipboard?.writeText(widgetCode); setCopied(true); }}>{copied ? "Copied" : "Copy embed code"} <Copy size={13} /></button><div className="widget-preview"><span /><span /><b>{collisionData.length}</b> collisions · Bengaluru <ArrowUpRight size={12} /></div></Reveal></div></div></section>;
}

function Impact({ data = projects, collisionData = detectedCollisions(data) }: { data?: Project[]; collisionData?: ReturnType<typeof detectedCollisions> }) {
  const agencies = new Set(data.map((project) => project.agency)).size;
  const overlapDistance = collisionData.reduce((total, collision) => total + Number.parseInt(collision.spatial, 10), 0);
  const overlapDays = collisionData.reduce((total, collision) => total + Number.parseInt(collision.schedule, 10), 0);
  const stats = [{ value: String(data.length), label: "projects analyzed", note: "synthetic records" }, { value: String(collisionData.length), label: "collisions detected", note: "spatial + schedule overlap" }, { value: String(agencies), label: "agencies cross-referenced", note: "represented in dataset" }, { value: String(overlapDistance), suffix: " m", label: "total overlap distance", note: "calculated collision proximity" }, { value: String(overlapDays), suffix: " days", label: "overlapping schedule days", note: "across detected windows" }];
  return <section className="impact-section section-light" id="impact"><div className="container"><Reveal><SectionLabel number="05">The compounding effect</SectionLabel><div className="impact-heading"><h2>Less rework.<br /><em>More city.</em></h2><p>When the city can see itself, the cost of moving forward drops.<br /><span className="demo-label"><i /> DEMO / SYNTHETIC DATA</span></p></div></Reveal><div className="stat-row">{stats.map((stat, index) => <Reveal delay={index * 80} className="stat" key={stat.label}><div className="stat-value">{stat.value}<small>{stat.suffix}</small></div><div className="stat-label">{stat.label}</div><div className="stat-note">— {stat.note}</div></Reveal>)}</div><div className="impact-rule" /></div></section>;
}

function Footer() {
  return <section className="footer-section"><div className="container footer-inner"><div className="footer-top"><span className="footer-kicker mono">CROSSCHECK / INFRASTRUCTURE INTELLIGENCE</span><span className="footer-coord mono">12.9716° N &nbsp; 77.5946° E</span></div><div className="footer-main"><h2>Build cities that<br /><span>don’t dig twice.</span></h2><p>CrossCheck turns fragmented infrastructure data into a shared view of what is happening across the city.</p><a className="button button-inverse" href="mailto:hello@crosscheck.city">Explore CrossCheck <ArrowUpRight size={16} /></a></div><div className="footer-bottom"><a href="#top" className="wordmark"><Mark /> CROSSCHECK</a><span>© 2026 CrossCheck</span><a href="#top">Back to top <ArrowUpRight size={13} /></a></div></div></section>;
}

export default function Home() {
  const data = useDataset();
  const collisionData = detectedCollisions(data);
  useEffect(() => {
    void hydrateFromApi();
  }, []);
  return <main><Hero /><StorySection /><CollisionSection /><HowItWorks /><LiveCityInteractive /><CivicIntelligence data={data} collisionData={collisionData} /><Impact data={data} collisionData={collisionData} /><Footer /></main>;
}
