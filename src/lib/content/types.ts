/**
 * Content model for The Holy Bible.
 *
 * Two strictly separated families of data:
 *  1. SCRIPTURE — verse text supplied by a TranslationAdapter. Never edited, never mixed with metadata.
 *  2. SUPPLEMENTARY — places, people, journeys, connections, phrases, threads, timeline, genealogy,
 *     measurements, inserts. Always refers to Scripture by OSIS reference ("Matt.2.5"), never by
 *     embedding or rewriting verse text. Every supplementary object carries provenance.
 */

/** OSIS-style verse reference: "Matt.2.5". Ranges: "Gen.46.3-4". */
export type VerseRef = string;
/** "Matt.2" */
export type ChapterRef = string;

export type Testament = 'OT' | 'NT';

/** Evidence levels. D (interpretive) never appears as objective discovery content. */
export type EvidenceLevel = 'A' | 'B' | 'C' | 'D';
export type EditorialStatus = 'draft' | 'researched' | 'reviewed' | 'approved' | 'published';

export interface Editorial {
  author: string;
  status: EditorialStatus;
  reviewedBy: string | null;
  reviewedAt: string | null;
}

/** Provenance carried by every supplementary object. */
export interface Provenance {
  evidenceLevel: EvidenceLevel;
  source: string;
  editorial: Editorial;
  notes?: string | null;
}

export interface Book {
  osis: string;
  name: string;
  testament: Testament;
  order: number;
  /** Traditional title, e.g. "The First Book of Moses, called GENESIS". */
  title?: string;
  titleParts?: { pre: string; main: string; post: string };
  division?: string;
  /** Verse count of each chapter (from the canon configuration). */
  verses?: number[];
  poetry?: boolean;
  chapterCount?: number;
}

export interface Translation {
  id: string;
  abbreviation: string;
  name: string;
  edition: string;
  license: string;
  role: 'development' | 'authorised';
  sources: { name: string; url: string; use: string }[];
  normalisation: string;
  checksums: Record<string, string>;
}

export interface Verse {
  ref: VerseRef;
  book: string;
  chapter: number;
  verse: number;
  /** Exact Scripture text from the translation. */
  text: string;
}

export interface Page {
  index: number;
  from: number;
  to: number;
}

export interface ChapterMeta {
  ref: ChapterRef;
  era: string;
  /** Approximate chronological rank used for "chronological order" views. */
  chrono: number;
  pageBreaks?: number[];
}

export interface Chapter extends ChapterMeta {
  book: Book;
  number: number;
  /** Verses in the active translation — empty until the book has loaded. */
  verses: Verse[];
  pages: Page[];
  /** Position in the canon (canonical order). */
  index: number;
  verseCount: number;
  loaded: boolean;
  /** Traditional-chronology year (model-dependent), when known. */
  year?: number | null;
}

export type ConnectionType =
  | 'FULFILLED'
  | 'QUOTED'
  | 'AS_WRITTEN'
  | 'REMEMBERED'
  | 'REPEATED_PHRASE'
  | 'SAME_PLACE'
  | 'SAME_EVENT'
  | 'GENEALOGY'
  | 'NAME'
  | 'TIME'
  | 'PLACE'
  | 'PARALLEL';

export interface CrossReferenceTarget {
  ref: VerseRef;
  type: ConnectionType;
  /** Words present in both passages — the evidence for the link. */
  sharedPhrase: string;
  /** For NAME links where the spelling differs between passages. */
  nameForms?: string[];
  /** Machine-found links: number of shared consecutive words and where they stand in each verse. */
  words?: number;
  anchorSpan?: [number, number];
  targetSpan?: [number, number];
}

/** Evidence scale for connections: 1 explicit quotation · 2 explicit fulfilment · 3 direct reference · 4 strong textual parallel. */
export type ConnectionLevel = 1 | 2 | 3 | 4;

export interface ProphetAttribution {
  attribution: string;
  namedInText: boolean;
  textName?: string;
  name: string | null;
  identifiedBy?: VerseRef;
  identifiedPhrase?: string;
}

export interface CrossReference extends Provenance {
  id: string;
  sourceVerses: VerseRef[];
  anchorVerse: VerseRef;
  types: ConnectionType[];
  evidence: { verse: VerseRef; phrase: string };
  targets: CrossReferenceTarget[];
  unassignedNote?: string;
  location?: string;
  threadIds: string[];
  prophet?: ProphetAttribution;
  level: ConnectionLevel;
  method: 'curated' | 'text-match';
}

export type IdCertainty = 'known' | 'probable' | 'traditional' | 'debated' | 'unknown' | 'region';

export interface SamePlace {
  label: string;
  evidence: VerseRef;
  phrase: string;
  level?: EvidenceLevel;
}

export type Certainty = 'HIGH' | 'PROBABLE' | 'POSSIBLE' | 'DISPUTED' | 'UNKNOWN';

export interface Place extends Provenance {
  id: string;
  name: string;
  /** Other names and spellings under which Scripture names this place. */
  names: string[];
  kind: string;
  certainty: Certainty;
  /** Leading modern identification (never given when UNKNOWN). */
  modern: string | null;
  lat: number | null;
  lon: number | null;
  alternatives: { name: string; lon: number; lat: number; score: number }[];
  identification?: string;
  samePlace?: SamePlace[];
  alsoAppears?: VerseRef[];
  note?: string;
  /** Verses where the place is named (full registry only). */
  verses?: VerseRef[];
  /** True while only the per-book summary is loaded. */
  partial?: boolean;
}

export interface Relationship {
  type: 'parent' | 'child' | 'sibling' | 'spouse' | 'ancestor' | 'descendant' | 'relative' | 'tribe' | 'dynasty' | 'ruler' | 'prophet';
  to: string;
  evidence: VerseRef;
  phrase: string;
}

export interface FamilyLink {
  type: 'father' | 'mother' | 'child' | 'sibling' | 'partner';
  to: string;
  /** The verse that states it, or where both are named — null when none has been identified. */
  ref: VerseRef | null;
  basis: 'stated' | 'named-together' | 'not-identified';
}

export interface Person extends Provenance {
  id: string;
  name: string;
  also: string[];
  gender?: string | null;
  kind?: string;
  summary?: string;
  relationships: FamilyLink[];
  /** Phase 2 curated relationships, each quoting its verse. */
  curatedRelationships?: Relationship[];
  verses?: VerseRef[];
  partial?: boolean;
}

export type RouteCertainty = 'explicit' | 'approximate' | 'reconstructed';

export interface JourneySegment {
  id: string;
  from: string | null;
  to: string | null;
  fromLabel?: string;
  toLabel?: string;
  verses: VerseRef[];
  anchor: VerseRef;
  certainty: RouteCertainty;
  evidenceLevel: EvidenceLevel;
  label: string;
  travellers: string;
  note?: string;
  style?: 'direction';
  path: [number, number][] | null;
}

export interface Journey {
  id: string;
  name: string;
  era: string;
  origin?: 'curated' | 'pipeline';
  segments: JourneySegment[];
  source: string;
  editorial: Editorial;
}

export interface Phrase extends Provenance {
  id: string;
  phrase: string;
  type: ConnectionType;
  extraRefs: VerseRef[];
}

export interface Thread extends Provenance {
  id: string;
  name: string;
  match: string | null;
  kind: 'wording' | 'place';
  place?: string;
  description: string;
  count: number;
  extraRefs?: VerseRef[];
}

export interface TimelineEvent {
  id: string;
  label: string;
  category: 'person' | 'journey' | 'ruler' | 'kingdom' | 'prophet' | 'event' | 'era';
  origin?: 'curated' | 'theographic';
  dateStart: number | null;
  dateEnd: number | null;
  dateType: 'range' | 'approximate' | 'duration' | 'explicit' | 'traditional';
  certainty: string;
  refs: VerseRef[];
  note: string | null;
  people?: string[];
  places?: string[];
  journey?: string;
  source: string;
  editorial: Editorial;
}

export interface GenealogyNode {
  id: string;
  name: string;
  person: string | null;
}

export interface GenealogyRelationship {
  parent: string;
  child: string;
  parentId: string;
  childId: string;
  evidence: VerseRef;
  phrase: string;
  clause?: string;
  mother?: string;
  relation?: string;
}

export interface Genealogy extends Provenance {
  id: string;
  title: string;
  kind?: 'matthew' | 'line';
  note?: string | null;
  evidence: VerseRef;
  sections?: { label: string; from: string; to: string }[];
  sectionsEvidence?: VerseRef;
  nodes: GenealogyNode[];
  edges: GenealogyRelationship[];
  branches?: { at: string; label: string; evidence: VerseRef; groups: { mother: string; children: string[]; evidence: VerseRef }[] }[];
  nameForms?: { forms: string[]; note: string }[];
}

export interface Measurement {
  id: string;
  label: string;
  dims: { length?: number; breadth?: number; height?: number; [k: string]: number | undefined };
  evidence: VerseRef;
  phrase: string;
  basis: 'stated' | 'derived';
  derivation?: string;
}

export interface ScaleSet {
  id: string;
  title: string;
  anchor: VerseRef;
  items: Measurement[];
  origin: 'curated' | 'pipeline';
}

export interface ScaleUnit {
  note: string;
  m?: number;
  g?: number;
  kg?: number;
  cubits?: number;
  common?: number;
  long?: number;
  evidence?: VerseRef;
}

export interface Scale extends Provenance {
  units: Record<string, ScaleUnit>;
  sets: ScaleSet[];
}

export interface Measurements extends Provenance {
  cubit: { common: number; long: number; note: string };
  items: Measurement[];
}

export interface ContextArtifact {
  id: string;
  kind: 'context' | 'scale' | 'genealogy' | 'timeline';
  anchorVerse: VerseRef;
  title: string;
  subtitle: string;
  focus?: string;
  sections?: { heading: string; items: { term: string; refs: VerseRef[]; text: string }[] }[];
  distances?: [string, string][];
  sources?: string;
  editorial: Editorial;
  evidenceLevel: EvidenceLevel;
}

export interface MapBase {
  width: number;
  height: number;
  attribution: string;
  land: string;
  lakes: Record<string, string>;
  rivers: Record<string, string>;
  graticule: string[];
  labels: { text: string; sub?: string; kind: string; xy: [number, number] }[];
  places: Record<string, [number, number]>;
  alternatives?: Record<string, [number, number][]>;
  segments: Record<string, { d: string; start: [number, number]; end: [number, number] }>;
}

/** What a single verse mentions — computed from the text through scoped aliases. */
export interface VerseEntities {
  places: { id: string; start: number; end: number }[];
  people: string[];
  phrases: string[];
}

// ---- Reader-side records (persisted locally) ----------------------------------------------

export interface ReaderEncounter {
  first: VerseRef;
  firstAt: number;
  refs: VerseRef[];
}
export type ReaderPlaceEncounter = ReaderEncounter;
export type ReaderPersonEncounter = ReaderEncounter;

export interface ReaderJourneyHistoryEntry {
  placeId: string;
  ref: VerseRef;
  at: number;
}

export interface Bookmark {
  id: string;
  chapter: ChapterRef;
  verse: number;
  page: number;
  color: 'crimson' | 'green' | 'blue';
  createdAt: number;
}

export interface ReadingHistoryEntry {
  chapter: ChapterRef;
  verse: number;
  at: number;
}
