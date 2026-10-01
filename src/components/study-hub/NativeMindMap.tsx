import React, { useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Fonts } from '@/config/fonts';
import { STUDY_GROWTH, STUDY_INK, STUDY_PAPER } from './studyPanelTokens';

type VisualItem = {
  id?: string;
  type: string;
  title?: string;
  data?: any;
};

type MapNode = {
  id: string;
  label: string;
  kind: 'overview' | 'pillar' | 'topic';
  parentId: string | null;
  accent: number;
  x: number;
  y: number;
  w: number;
  h: number;
  childCount: number;
  isCollapsed: boolean;
};

const SIZES = {
  overview: { w: 228, h: 48 },
  pillar: { w: 216, h: 42 },
  topic: { w: 188, h: 38 },
};
const GAP_X = 52;
const GAP_Y = 12;
const PAD = 20;

const ACCENTS = [
  { stroke: '#1a2f23', fill: 'rgba(26,47,35,0.08)' },
  { stroke: '#3f6b4f', fill: 'rgba(63,107,79,0.12)' },
  { stroke: '#0f766e', fill: 'rgba(15,118,110,0.10)' },
  { stroke: '#b45309', fill: 'rgba(180,83,9,0.10)' },
  { stroke: '#0369a1', fill: 'rgba(3,105,161,0.10)' },
  { stroke: '#6d28d9', fill: 'rgba(109,40,217,0.08)' },
];

function sameId(a: unknown, b: unknown) {
  return String(a ?? '') === String(b ?? '');
}

function layoutNodes(
  visual: VisualItem,
  collapsed: Set<string>,
): { nodes: MapNode[]; width: number; height: number; collapsibleIds: string[] } {
  const data = visual.data || {};
  const pillars: any[] = Array.isArray(data.pillars) ? data.pillars : [];
  const topics: any[] = Array.isArray(data.topics) ? data.topics : [];
  const rootId = `map-root-${visual.id || 'doc'}`;
  const ov = SIZES.overview;
  const pl = SIZES.pillar;
  const tp = SIZES.topic;
  const rootCollapsed = collapsed.has(rootId);

  const pillarMetas = pillars.map((p, i) => {
    const pid = `pillar-${p.id}`;
    const kids = topics.filter((t) => sameId(t.pillar_id, p.id));
    const open = !rootCollapsed && !collapsed.has(pid);
    const subtreeH = pl.h + (open ? kids.length * (tp.h + GAP_Y) : 0);
    return { p, i, pid, kids, open, subtreeH };
  });

  const visiblePillars = rootCollapsed ? [] : pillarMetas;
  const stackH = visiblePillars.reduce((sum, m, idx) => sum + m.subtreeH + (idx ? GAP_Y + 8 : 0), 0);
  const height = Math.max(ov.h, stackH || ov.h) + PAD * 2;
  const pillarX = PAD + ov.w + GAP_X;
  const topicX = pillarX + pl.w + GAP_X;
  const overviewY = PAD + Math.max(0, (stackH - ov.h) / 2);

  const nodes: MapNode[] = [
    {
      id: rootId,
      label: visual.title || 'Mind map',
      kind: 'overview',
      parentId: null,
      accent: 0,
      x: PAD,
      y: overviewY,
      w: ov.w,
      h: ov.h,
      childCount: pillars.length,
      isCollapsed: rootCollapsed,
    },
  ];

  let yCursor = PAD;
  visiblePillars.forEach((m) => {
    nodes.push({
      id: m.pid,
      label: m.p.label || 'Theme',
      kind: 'pillar',
      parentId: rootId,
      accent: m.i,
      x: pillarX,
      y: yCursor,
      w: pl.w,
      h: pl.h,
      childCount: m.kids.length,
      isCollapsed: !m.open,
    });
    if (m.open) {
      m.kids.forEach((t: any, ti: number) => {
        nodes.push({
          id: `topic-${t.id}`,
          label: t.label || 'Topic',
          kind: 'topic',
          parentId: m.pid,
          accent: m.i,
          x: topicX,
          y: yCursor + pl.h + GAP_Y + ti * (tp.h + GAP_Y),
          w: tp.w,
          h: tp.h,
          childCount: 0,
          isCollapsed: false,
        });
      });
    }
    yCursor += m.subtreeH + GAP_Y + 8;
  });

  const hasTopics = visiblePillars.some((m) => m.open && m.kids.length > 0);
  const width = (hasTopics ? topicX + tp.w : visiblePillars.length ? pillarX + pl.w : PAD + ov.w) + PAD;
  const collapsibleIds = [
    ...(pillars.length ? [rootId] : []),
    ...pillarMetas.filter((m) => m.kids.length > 0).map((m) => m.pid),
  ];
  return { nodes, width, height, collapsibleIds };
}

function elbow(from: MapNode, to: MapNode) {
  const x1 = from.x + from.w;
  const y1 = from.y + from.h / 2;
  const x2 = to.x;
  const y2 = to.y + to.h / 2;
  const mx = (x1 + x2) / 2;
  return `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
}

type Props = {
  visual: VisualItem;
  isDark?: boolean;
};

function toggleId(prev: Set<string>, id: string) {
  const next = new Set(prev);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

export const NativeMindMap: React.FC<Props> = ({ visual, isDark }) => {
  const [collapsed, setCollapsed] = useState<Set<string>>(() => {
    const pillars: any[] = Array.isArray(visual.data?.pillars) ? visual.data.pillars : [];
    return new Set(pillars.slice(1).map((p) => `pillar-${p.id}`));
  });

  const { nodes, width, height, collapsibleIds } = useMemo(
    () => layoutNodes(visual, collapsed),
    [visual, collapsed],
  );
  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const edges = nodes.filter((n) => n.parentId && byId.has(n.parentId));

  const paper = isDark ? '#12141A' : STUDY_PAPER;
  const nodeBg = isDark ? '#1A1D24' : '#FFFFFF';
  const labelColor = isDark ? '#F4F4F5' : STUDY_INK;
  const border = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(63,107,79,0.14)';

  return (
    <View style={[styles.root, { backgroundColor: paper }]}>
      <View style={styles.toolbar}>
        <Pressable
          onPress={() => setCollapsed(new Set())}
          accessibilityRole="button"
          accessibilityLabel="Expand all branches"
          style={[styles.toolBtn, { backgroundColor: nodeBg, borderColor: border }]}
        >
          <Text style={[styles.toolLabel, { color: labelColor }]}>Expand all</Text>
        </Pressable>
        <Pressable
          onPress={() => setCollapsed(new Set(collapsibleIds.filter((id) => !id.startsWith('map-root-'))))}
          accessibilityRole="button"
          accessibilityLabel="Collapse all branches"
          style={[styles.toolBtn, { backgroundColor: nodeBg, borderColor: border }]}
        >
          <Text style={[styles.toolLabel, { color: labelColor }]}>Collapse</Text>
        </Pressable>
      </View>
      <ScrollView
        horizontal
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ minWidth: width }}
      >
        <ScrollView
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ minHeight: height }}
        >
          <View style={{ width, height }} pointerEvents="box-none">
            <Svg pointerEvents="none" width={width} height={height} style={StyleSheet.absoluteFill}>
              {edges.map((n) => {
                const parent = byId.get(n.parentId!);
                if (!parent) return null;
                const accent = ACCENTS[n.accent % ACCENTS.length];
                return (
                  <Path
                    key={`${n.parentId}-${n.id}`}
                    d={elbow(parent, n)}
                    stroke={accent.stroke}
                    strokeWidth={n.kind === 'topic' ? 1.5 : 2}
                    fill="none"
                    opacity={0.55}
                  />
                );
              })}
            </Svg>
            {nodes.map((n) => {
              const accent = ACCENTS[n.accent % ACCENTS.length];
              const tappable = n.childCount > 0;
              return (
                <Pressable
                  key={n.id}
                  disabled={!tappable}
                  accessibilityRole={tappable ? 'button' : 'none'}
                  accessibilityLabel={
                    tappable
                      ? `${n.label}. ${n.isCollapsed ? 'Expand' : 'Collapse'} branch`
                      : n.label
                  }
                  accessibilityState={tappable ? { expanded: !n.isCollapsed } : undefined}
                  onPress={() => {
                    if (!tappable) return;
                    setCollapsed((prev) => toggleId(prev, n.id));
                  }}
                  style={[
                    styles.node,
                    {
                      left: n.x,
                      top: n.y,
                      width: n.w,
                      height: n.h,
                      backgroundColor: nodeBg,
                      borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(26,47,35,0.1)',
                    },
                    tappable && Platform.OS === 'web' ? styles.nodeTappable : null,
                  ]}
                >
                  <View
                    style={[
                      styles.accent,
                      { backgroundColor: n.kind === 'overview' ? STUDY_GROWTH : accent.stroke },
                    ]}
                  />
                  <Text
                    numberOfLines={2}
                    style={[
                      styles.nodeLabel,
                      {
                        color: labelColor,
                        fontFamily: n.kind === 'overview' ? Fonts.ui.semiBold : Fonts.ui.medium,
                        fontSize: n.kind === 'overview' ? 14 : 13,
                      },
                    ]}
                  >
                    {n.label}
                  </Text>
                  {tappable ? (
                    <Text
                      style={[styles.toggle, { color: n.kind === 'overview' ? STUDY_GROWTH : accent.stroke }]}
                    >
                      {n.isCollapsed ? '+' : '−'}
                    </Text>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  toolbar: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 6,
    zIndex: 2,
  },
  toolBtn: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  toolLabel: { fontFamily: Fonts.ui.semiBold, fontSize: 11 },
  node: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingRight: 8,
    overflow: 'hidden',
    zIndex: 1,
    shadowColor: '#1A2F23',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  nodeTappable: {
    cursor: 'pointer',
  },
  accent: { width: 4, alignSelf: 'stretch', marginRight: 10 },
  nodeLabel: { flex: 1, fontFamily: Fonts.ui.medium },
  toggle: {
    width: 22,
    textAlign: 'center',
    fontFamily: Fonts.ui.semiBold,
    fontSize: 16,
    lineHeight: 20,
  },
});
