import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { EXERCISE_CATALOG } from '../exercise-catalog.js';
import { EXERCISE_VIDEOS, getExerciseVideo } from '../exercise-videos.js';
import { resolveRankingExercise } from '../exercise-catalog.js';
import { createExerciseVideo, stopExerciseVideos } from '../exercise-video-ui.js';

class Element {
  constructor(tag) { this.tagName=tag.toUpperCase();this.children=[];this.events=new Map();this.open=false;this.textContent=''; }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children=children; }
  addEventListener(type,handler) { this.events.set(type,handler); }
  setAttribute(key,value) { this[key]=value; }
  toggle(open) { this.open=open;this.events.get('toggle')(); }
  querySelector(selector) { return this.children.find(child=>'.'+child.className===selector); }
}
const document={createElement:tag=>new Element(tag)};
const example={id:'abcdefghijk',source:'Voorbeeldkanaal',exercise:'Squat'};
const fixture=()=>({document,findVideo:()=>example,isOnline:()=>true});

 test('video mapping uses exact known names and aliases, preserving material distinctions and free names',()=>{
  const videos={'ex:squat':example,'ex:bench-press':{...example,id:'ABCDEFGHIJK'},'ex:bench-press-machine':{...example,id:'0123456789_'}};
  assert.equal(getExerciseVideo({name:'Squats'},videos).key,'ex:squat');
  assert.equal(getExerciseVideo({name:'Bench press',rankingKey:'ex:bench-press-machine'},videos).id,'ABCDEFGHIJK');
  assert.equal(getExerciseVideo({name:'Bench press machine'},videos).id,'0123456789_');
  assert.equal(getExerciseVideo({name:'Mijn eigen oefening',rankingKey:'ex:squat'},videos),null);
  assert.equal(getExerciseVideo({name:'Squat'},{}),null);
  assert.equal(getExerciseVideo({name:'Squat'},{'ex:squat':{id:'bad/url',source:'X'}}),null);
 });

test('collapsed exercise reference creates no frame or external source link',()=>{
 const details=createExerciseVideo({name:'Squat'},fixture());
 assert.equal(details.open,false);assert.equal(details.children[0].children[1].textContent,'Uitlegvideo van oefening');
 assert.equal(details.children[0].children[0].className,'exercise-video-icon');
 assert.equal(details.children[0].children[0]['aria-hidden'],'true');
 assert.deepEqual(details.children[1].children,[]);
 assert.equal(createExerciseVideo({name:'Onbekend'},{document,findVideo:()=>null}),null);
});

test('expanding loads the privacy-enhanced player and an exact source link, without autoplay or private values',()=>{
 const details=createExerciseVideo({name:'Squat',weight:50,reps:8,sets:3},fixture());details.toggle(true);
 const content=details.children[1],iframe=content.children[0].children[0],source=content.children[1],link=source.children[0];
 assert.equal(iframe.tagName,'IFRAME');assert.equal(iframe.src,'https://www.youtube-nocookie.com/embed/abcdefghijk?playsinline=1&rel=0');
 assert.equal(iframe.referrerPolicy,'strict-origin-when-cross-origin');assert.equal(iframe.loading,'lazy');
 assert.equal(iframe.src.includes('autoplay'),false);assert.equal(iframe.title,'Uitleg: Squat');
 assert.equal(source.textContent,'Bron: ');assert.equal(link.href,'https://www.youtube.com/watch?v=abcdefghijk');
 assert.equal(link.textContent,'Voorbeeldkanaal · YouTube');assert.equal(link.target,'_blank');assert.equal(link.rel,'noopener noreferrer');
});

test('closing removes the player, reopening creates a new one, and page changes stop playback',()=>{
 const details=createExerciseVideo({name:'Squat'},fixture());details.toggle(true);
 const first=details.children[1].children[0].children[0]; details.toggle(false);assert.deepEqual(details.children[1].children,[]);
 details.toggle(true);assert.notEqual(details.children[1].children[0].children[0],first);
 stopExerciseVideos({querySelectorAll:()=>[details]});assert.equal(details.open,false);assert.deepEqual(details.children[1].children,[]);
});

test('offline expansion keeps the logbook usable and supplies a source link without creating a player',()=>{
 const details=createExerciseVideo({name:'Squat'},{...fixture(),isOnline:()=>false});details.toggle(true);
 const content=details.children[1];assert.equal(content.children[0].children[0].tagName,'P');
 assert.equal(content.children[0].children[0].textContent,'De video heeft internet nodig.');
 assert.equal(content.children[1].children[0].href,'https://www.youtube.com/watch?v=abcdefghijk');
});

test('published video entries have known exercise keys and valid YouTube identifiers and source labels',()=>{
 const keys=new Set(EXERCISE_CATALOG.map(x=>x.key));
 for(const [key,video] of Object.entries(EXERCISE_VIDEOS)) {
  assert.equal(keys.has(key),true,key);assert.match(video.id,/^[A-Za-z0-9_-]{11}$/u,key);
  assert.equal(typeof video.source,'string');assert.ok(video.source.trim());
 }
});

test('every catalog reference matches its documented source, with no undocumented or duplicate mappings',async()=>{
 const sources=JSON.parse(await readFile(new URL('../video-sources.json',import.meta.url),'utf8'));
 const catalogKeys=new Set(EXERCISE_CATALOG.map(exercise=>exercise.key));
 const documented=[...sources.videos,...sources.unmatched];
 assert.equal(sources.catalogCount,EXERCISE_CATALOG.length);
 assert.equal(sources.referenceCount,Object.keys(EXERCISE_VIDEOS).length);
 assert.equal(sources.videos.length,sources.referenceCount);
 assert.equal(documented.length,catalogKeys.size);
 assert.equal(new Set(documented.map(row=>row.key)).size,catalogKeys.size);
 for(const row of documented) assert.ok(catalogKeys.has(row.key),row.key);
 for(const row of sources.videos) {
  assert.deepEqual(EXERCISE_VIDEOS[row.key],{id:row.id,source:row.sourceLabel},row.key);
  assert.equal(new URL(row.sourceUrl).protocol,'https:',row.key);
  assert.ok(row.title && row.source && row.verificationUrl && row.verifiedAt,row.key);
  assert.equal(row.embeddable,true,row.key);
  assert.ok(Number.isInteger(row.durationSeconds) && row.durationSeconds>0 && row.durationSeconds<=180,row.key);
 }
 for(const row of sources.unmatched) assert.equal(EXERCISE_VIDEOS[row.key],undefined,row.key);
});

test('every documented catalog name and spelling variant uses its own reference when available',()=>{
 for(const exercise of EXERCISE_CATALOG) for(const name of [exercise.label,...exercise.aliases]) {
  const key=EXERCISE_VIDEOS[exercise.key] ? exercise.key : undefined;
  assert.equal(getExerciseVideo({name})?.key,key,name);
  assert.equal(getExerciseVideo({name:`  ${name.toUpperCase()}!!  `})?.key,key,name);
 }
});

test('researched new catalog exercises have their own references while preserving entered names',()=>{
 const examples={
  'Lat pull down machine':'ex:lat-pulldown',
  'Z bar bicep curl':'ex:ez-bar-biceps-curl',
  'Low row machine':'ex:low-row-machine',
  'Reverse fly machine':'ex:reverse-fly-machine',
  'Reverse pec deck':'ex:reverse-fly-machine',
 };
 for(const [name,key] of Object.entries(examples)) {
  const exercise=Object.freeze({name,sets:3,reps:8,weight:20});
  assert.equal(getExerciseVideo(exercise)?.key,key,name);
  assert.equal(exercise.name,name);
  assert.equal(resolveRankingExercise(exercise).key,key,name);
 }
 for(const name of ['Low row barbell','Reverse fly dumbbell','Bent over row','Mijn eigen oefening']) {
  assert.equal(getExerciseVideo({name}),null,name);
 }
});

test('search tolerance never assigns videos to custom names or manual ranking overrides',()=>{
 for(const name of ['Dumbel row','Bent over row','Mijn reverse fly machine','Mijn persoonlijke oefening'])
  assert.equal(getExerciseVideo({name,rankingKey:'ex:dumbbell-row'}),null,name);
});
