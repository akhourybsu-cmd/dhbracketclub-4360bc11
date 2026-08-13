import { describe, expect, it } from 'vitest';
import { validateCampaign } from '@/lib/journey/validate';
import type { CampaignPackage } from '@/lib/journey/types';

const pkg = (over: Partial<CampaignPackage> = {}): CampaignPackage => ({
  campaign: { slug: 'test', title: 'Test', starting_scene_key: 'a' },
  scenes: [
    { scene_key: 'a', blocks: [{ block_type: 'narration', content: 'One.' }], choices: [{ choice_key: 'go', choice_text: 'Go', next_scene_key: 'b' }] },
    { scene_key: 'b', is_terminal: true, blocks: [{ block_type: 'narration', content: 'Two.' }] },
  ],
  ...over,
} as CampaignPackage);

const codes = (p: CampaignPackage) => validateCampaign(p).issues.map((i) => i.code);

describe('journey campaign validation', () => {
  it('passes a minimal well-formed campaign', () => {
    const res = validateCampaign(pkg());
    expect(res.errors).toBe(0);
    expect(res.canPublish).toBe(true);
  });

  it('allows the same choice key in different scenes', () => {
    const res = validateCampaign(pkg({
      scenes: [
        { scene_key: 'a', blocks: [{ block_type: 'narration', content: 'x' }], choices: [{ choice_key: 'continue', choice_text: 'On', next_scene_key: 'b' }] },
        { scene_key: 'b', blocks: [{ block_type: 'narration', content: 'y' }], choices: [{ choice_key: 'continue', choice_text: 'On', next_scene_key: 'c' }] },
        { scene_key: 'c', is_terminal: true, blocks: [{ block_type: 'narration', content: 'z' }] },
      ],
    } as any));
    expect(res.issues.filter((i) => i.code === 'duplicate_choice_key')).toHaveLength(0);
    expect(res.errors).toBe(0);
  });

  it('rejects duplicate choice keys within one scene', () => {
    const res = validateCampaign(pkg({
      scenes: [
        {
          scene_key: 'a', blocks: [{ block_type: 'narration', content: 'x' }],
          choices: [
            { choice_key: 'go', choice_text: 'A', next_scene_key: 'b' },
            { choice_key: 'go', choice_text: 'B', next_scene_key: 'b' },
          ],
        },
        { scene_key: 'b', is_terminal: true, blocks: [{ block_type: 'narration', content: 'y' }] },
      ],
    } as any));
    expect(res.errors).toBeGreaterThan(0);
    expect(codes(pkg())).not.toContain('duplicate_choice_key');
    expect(res.issues.some((i) => i.code === 'duplicate_choice_key')).toBe(true);
  });

  it('validates automatic-transition destinations', () => {
    const res = validateCampaign(pkg({
      scenes: [
        { scene_key: 'a', auto_next_scene_key: 'nowhere', blocks: [{ block_type: 'narration', content: 'x' }] },
        { scene_key: 'b', is_terminal: true, blocks: [{ block_type: 'narration', content: 'y' }] },
      ],
    } as any));
    expect(res.issues.some((i) => i.code === 'invalid_destination')).toBe(true);
    expect(res.canPublish).toBe(false);
  });

  it('requires routing nodes to route somewhere and never end the run', () => {
    const res = validateCampaign(pkg({
      scenes: [
        { scene_key: 'a', is_routing_node: true, is_terminal: true, blocks: [], choices: [] },
        { scene_key: 'b', is_terminal: true, blocks: [{ block_type: 'narration', content: 'y' }] },
      ],
    } as any));
    const c = res.issues.map((i) => i.code);
    expect(c).toContain('routing_node_no_destination');
    expect(c).toContain('routing_node_terminal');
  });

  it('accepts a valid routing node without warning about empty narration', () => {
    const res = validateCampaign(pkg({
      scenes: [
        { scene_key: 'a', blocks: [{ block_type: 'narration', content: 'x' }], choices: [{ choice_key: 'go', choice_text: 'Go', next_scene_key: 'r' }] },
        { scene_key: 'r', is_routing_node: true, auto_next_scene_key: 'b', blocks: [], choices: [] },
        { scene_key: 'b', is_terminal: true, blocks: [{ block_type: 'narration', content: 'y' }] },
      ],
    } as any));
    expect(res.errors).toBe(0);
    expect(res.issues.some((i) => i.code === 'empty_scene' && i.scene_key === 'r')).toBe(false);
  });
});
