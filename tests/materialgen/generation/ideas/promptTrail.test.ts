import { describe, expect, it } from 'vitest';
import { canReset, EMPTY_IDEAS, MAX_TRAIL, pickIdea, receiveIdeas, resetToPrevious, selectedIdea, type IdeasState } from '@mat/generation/ideas/promptTrail';

const SET_ONE = ['idea 1', 'idea 2', 'idea 3'];
const SET_TWO = ['n1', 'n2', 'n3'];

describe('promptTrail', () => {
  it('materialgen/generation R71 R73 before any set there are no ideas, nothing is selected and Reset is off', () => {
    expect(EMPTY_IDEAS.ideas).toEqual([]);
    expect(selectedIdea(EMPTY_IDEAS, 'anything')).toBeNull();
    expect(canReset(EMPTY_IDEAS)).toBe(false);
  });

  it('materialgen/generation R72 a set replaces the earlier one whole and leaves the trail alone', () => {
    const first = receiveIdeas(EMPTY_IDEAS, SET_ONE);
    expect(first.ideas).toEqual(SET_ONE);
    expect(first.trail).toEqual([]);
    expect(receiveIdeas(first, SET_TWO).ideas).toEqual(SET_TWO);
    expect(canReset(receiveIdeas(first, SET_TWO))).toBe(false);
  });

  it('materialgen/generation R73 an idea is selected exactly while the field text equals it, typing it back selects it again', () => {
    const state = receiveIdeas(EMPTY_IDEAS, SET_ONE);
    expect(selectedIdea(state, 'idea 2')).toBe(1);
    expect(selectedIdea(state, 'idea 2 edited')).toBeNull();
    expect(selectedIdea(state, 'A')).toBeNull();
    expect(selectedIdea(receiveIdeas(state, SET_TWO), 'idea 2')).toBeNull(); // the set was replaced
  });

  it('materialgen/generation R74 wrote A, picked 1, edited to 1b, picked 2: Reset gives 1b, then A, then it is off and the field stays A', () => {
    let state: IdeasState = receiveIdeas(EMPTY_IDEAS, SET_ONE);
    state = pickIdea(state, 'A', 0).state; // field: idea 1
    state = pickIdea(state, 'idea 1 edited', 1).state; // the user edited it, then picked 2
    expect(state.trail).toEqual(['A', 'idea 1 edited']);
    const back1 = resetToPrevious(state);
    expect(back1?.text).toBe('idea 1 edited');
    const back2 = resetToPrevious(back1!.state);
    expect(back2?.text).toBe('A');
    expect(canReset(back2!.state)).toBe(false);
    expect(resetToPrevious(back2!.state)).toBeNull();
  });

  it('materialgen/generation R74 wrote A, got ideas, picked 1, 2, 3 without editing: one Reset gives A and then Reset is off', () => {
    let state: IdeasState = receiveIdeas(EMPTY_IDEAS, SET_ONE);
    state = pickIdea(state, 'A', 0).state;
    state = pickIdea(state, 'idea 1', 1).state;
    state = pickIdea(state, 'idea 2', 2).state;
    expect(state.trail).toEqual(['A']);
    const back = resetToPrevious(state);
    expect(back?.text).toBe('A');
    expect(canReset(back!.state)).toBe(false);
  });

  it('materialgen/generation R74 wrote A, got ideas, pressed Reset at once: it is off, nothing was pushed', () => {
    const state = receiveIdeas(EMPTY_IDEAS, SET_ONE);
    expect(canReset(state)).toBe(false);
    expect(resetToPrevious(state)).toBeNull();
  });

  it('materialgen/generation R74 picking returns the idea as the new text', () => {
    expect(pickIdea(receiveIdeas(EMPTY_IDEAS, SET_ONE), 'A', 2).text).toBe('idea 3');
  });

  it('materialgen/generation R74 a blank field is never pushed', () => {
    const state = receiveIdeas(EMPTY_IDEAS, SET_ONE);
    expect(pickIdea(state, '   ', 0).state.trail).toEqual([]);
    expect(pickIdea(state, '', 0).state.trail).toEqual([]);
  });

  it('materialgen/generation R74 an idea shown earlier, even from a replaced set, is not pushed when the field still holds it', () => {
    let state: IdeasState = receiveIdeas(EMPTY_IDEAS, SET_ONE);
    state = pickIdea(state, 'A', 0).state; // field: idea 1, trail [A]
    state = receiveIdeas(state, SET_TWO);
    state = pickIdea(state, 'idea 1', 1).state; // idea 1 belongs to the replaced set
    expect(state.trail).toEqual(['A']);
  });

  it('materialgen/generation R74 Reset empties the trail one text at a time, and an idea picked after it pushes the field text again', () => {
    let state: IdeasState = receiveIdeas(EMPTY_IDEAS, SET_ONE);
    state = pickIdea(state, 'A', 0).state;
    const back = resetToPrevious(state)!;
    expect(back.text).toBe('A');
    expect(canReset(back.state)).toBe(false);
    const again = pickIdea(back.state, back.text, 2);
    expect(again.state.trail).toEqual(['A']);
    expect(resetToPrevious(again.state)?.text).toBe('A');
  });

  it('materialgen/generation R74 a new set does not touch the trail', () => {
    let state: IdeasState = receiveIdeas(EMPTY_IDEAS, SET_ONE);
    state = pickIdea(state, 'A', 0).state;
    expect(receiveIdeas(state, SET_TWO).trail).toEqual(['A']);
  });

  it('materialgen/generation R74 the trail keeps at most 20 texts and drops the oldest', () => {
    let state: IdeasState = receiveIdeas(EMPTY_IDEAS, SET_ONE);
    for (let at = 0; at < MAX_TRAIL + 5; at += 1) state = pickIdea(state, `text ${at}`, 0).state;
    expect(state.trail).toHaveLength(MAX_TRAIL);
    expect(state.trail[0]).toBe('text 5');
    expect(state.trail.at(-1)).toBe(`text ${MAX_TRAIL + 4}`);
  });
});
