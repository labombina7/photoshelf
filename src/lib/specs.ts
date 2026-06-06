import fs from 'fs';
import path from 'path';

const SPECS_DIR = path.join(process.cwd(), 'specs');
const TODO_DIR = path.join(SPECS_DIR, 'todo');
const DONE_DIR = path.join(SPECS_DIR, 'done');

export interface SpecMeta {
  slug: string;          // filename without .md
  id: string;            // US-001, EPIC-002, etc.
  title: string;         // extracted from # heading
  status: 'todo' | 'done';
  effort?: string;       // S / M / L if present in file
}

function parseTitle(content: string): string {
  const match = content.match(/^# (.+)/m);
  if (!match) return '';
  // Remove the ID prefix: "# US-001 — Title" → "Title"
  return match[1].replace(/^[\w-]+ [—–-] /, '').trim();
}

function parseId(filename: string): string {
  return filename.replace(/\.md$/, '').split('-').slice(0, 2).join('-').toUpperCase();
}

function parseEffort(content: string): string | undefined {
  const match = content.match(/\*\*Esfuerzo[^*]*\*\*[:\s]+([SML])\b/i)
    ?? content.match(/Esfuerzo[:\s]+([SML])\b/i)
    ?? content.match(/effort[:\s]+([SML])\b/i);
  return match?.[1]?.toUpperCase();
}

function readDir(dir: string, status: 'todo' | 'done'): SpecMeta[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.md') && f !== '.gitkeep')
    .map(filename => {
      const slug = filename.replace(/\.md$/, '');
      const content = fs.readFileSync(path.join(dir, filename), 'utf-8');
      return {
        slug,
        id: parseId(filename),
        title: parseTitle(content),
        status,
        effort: parseEffort(content),
      };
    })
    .sort((a, b) => a.slug.localeCompare(b.slug));
}

export function getAllSpecs(): { todo: SpecMeta[]; done: SpecMeta[] } {
  return {
    todo: readDir(TODO_DIR, 'todo'),
    done: readDir(DONE_DIR, 'done').reverse(), // most recent first
  };
}

export function getSpecContent(slug: string): { content: string; status: 'todo' | 'done' } | null {
  for (const [dir, status] of [[DONE_DIR, 'done'], [TODO_DIR, 'todo']] as const) {
    const filePath = path.join(dir, `${slug}.md`);
    if (fs.existsSync(filePath)) {
      return { content: fs.readFileSync(filePath, 'utf-8'), status };
    }
  }
  return null;
}
