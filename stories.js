// ============================================================
// Ivrit Quest — Bible Stories (Tanakh) core
// Story data lives in stories-a.js … stories-d.js (loaded after this file),
// each calling STORIES.push({...}) per story.
// ============================================================

const STORY_ERAS = [
  { id: 'beginnings', title: 'In the Beginning', emoji: '🌌' },
  { id: 'fathers',    title: 'Abraham & Isaac',  emoji: '🐫' },
  { id: 'jacob',      title: 'Jacob & Joseph',   emoji: '🌈' },
  { id: 'exodus',     title: 'Moses & Egypt',    emoji: '🏺' },
  { id: 'desert',     title: 'In the Desert',    emoji: '⛺' },
  { id: 'land',       title: 'Heroes of the Land', emoji: '🦁' },
  { id: 'kings',      title: 'David & Solomon',  emoji: '👑' },
];

const STORIES = [];
