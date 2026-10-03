'use client';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { getLibrary, type Library } from '@/lib/content/repository';
import type { VerseRef } from '@/lib/content/types';

/** The library plus a version number that changes whenever more of it has loaded. */
export function useLibrary(): { lib: Library; version: number } {
  const lib = getLibrary();
  const version = useSyncExternalStore(lib.subscribe, lib.getVersion, lib.getVersion);
  return { lib, version };
}

/** Make sure the books holding these references are loaded; true once they can be read. */
export function useRefsReady(refs: VerseRef[]): boolean {
  const { lib } = useLibrary();
  const key = refs.join('|');
  const [, force] = useState(0);
  useEffect(() => {
    if (!refs.length || lib.hasRefs(refs)) return;
    let live = true;
    lib.ensureRefs(refs).then(() => live && force((n) => n + 1)).catch(() => {});
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, lib]);
  return lib.hasRefs(refs);
}

/** Load a registry (places, people, timeline, map) when a view needs it. */
export function useRegistry(name: 'places' | 'people' | 'timeline' | 'map'): boolean {
  const { lib } = useLibrary();
  useEffect(() => {
    const fn = { places: lib.ensurePlaces, people: lib.ensurePeople, timeline: lib.ensureTimeline, map: lib.ensureMap }[name];
    fn.call(lib).catch(() => {});
  }, [lib, name]);
  return lib.registries[name];
}
