import {test} from 'node:test';
import assert from 'node:assert/strict';
import type {OnlineTimerState} from '../../shared/contracts';
import {anchorOnlineClock,onlineRemainingMs} from '../src/onlineClock';
const fixture=():OnlineTimerState=>({turnId:'1',serverNow:'2026-11-11T12:00:05Z',openedAt:'2026-11-11T12:00:00Z',deadlineAt:'2026-11-11T12:00:15Z',durationSeconds:15,running:true,lastClosure:null,inactivity:[]});
test('online countdown uses server deadline, RTT and monotonic time, not a skewed calendar',()=>{
 const t=fixture();anchorOnlineClock(t,100,300);
 assert.equal(onlineRemainingMs(t,300),9900);assert.equal(onlineRemainingMs(t,5300),4900);assert.equal(onlineRemainingMs(t,12000),0);
 const original=Date.now;try{Date.now=()=>original()+24*60*60*1000;assert.equal(onlineRemainingMs(t,5300),4900);}finally{Date.now=original;}
});
test('reload and action responses rebase the same deadline without resetting the turn',()=>{
 const t=fixture();anchorOnlineClock(t,0,0);assert.equal(onlineRemainingMs(t,5000),5000);
 const reloaded={...t,serverNow:'2026-11-11T12:00:10Z'};anchorOnlineClock(reloaded,5000,5000);assert.equal(onlineRemainingMs(reloaded,5000),5000);
 const next={...t,turnId:'2',serverNow:'2026-11-11T12:00:15Z',openedAt:'2026-11-11T12:00:15Z',deadlineAt:'2026-11-11T12:00:30Z'};anchorOnlineClock(next,10000,10000);assert.equal(onlineRemainingMs(next,10000),15000);
 assert.equal(onlineRemainingMs({...next,running:false},10000),0);
});
