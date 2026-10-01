import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text } from 'react-native-paper';
import { useAuthStore } from '@/store';
import { useAppTheme } from '@/store/appThemeStore';
import { lightTheme, darkTheme } from '@/theme';
import { useContent, useJobStatus } from '@/api/queries/content';
import apiClient from '@/api/client';
import { contentService } from '@/services/contentService';
import StudyGenerationProcessingScreen from './StudyGenerationProcessingScreen';
import { PanelSkeleton } from '@/components/ui/skeleton';
import { GitBranch } from '@/icons';
import { Fonts } from '@/config/fonts';
import { NativeMindMap } from './NativeMindMap';
import { StudyPillButton } from './StudyPillButton';
import {
  STUDY_INK,
  STUDY_PAPER,
  STUDY_PAPER_DARK,
  STUDY_ZINC_500,
} from './studyPanelTokens';

type VisualItem = {
  id?: string;
  type: string;
  title?: string;
  data?: any;
};

interface DiagramTabProps {
  contentId: number;
  onNavigateToTab?: () => void;
}

const PILLAR_COLORS_LIGHT = ['#1a2f23', '#3d5a4a', '#5c7a6a', '#2f4f3e', '#4a6b5a', '#6b8f7a'];
const PILLAR_COLORS_DARK = ['#a8c4b4', '#8fad9c', '#7a9a88', '#b8d0c4', '#96b5a5', '#c4d9ce'];

const DocumentMapCard: React.FC<{ visual: VisualItem; dark: boolean; theme: any }> = ({
  visual,
  dark,
  theme,
}) => {
  const data = visual.data || {};
  const overview = String(data.overview || '').trim();
  const pillars: any[] = Array.isArray(data.pillars) ? data.pillars : [];
  const topics: any[] = Array.isArray(data.topics) ? data.topics : [];
  const relations: any[] = Array.isArray(data.relations) ? data.relations : [];
  const sequence: any[] = Array.isArray(data.sequence) ? data.sequence : [];
  const colors = dark ? PILLAR_COLORS_DARK : PILLAR_COLORS_LIGHT;
  const topicById = useMemo(() => new Map(topics.map((t) => [t.id, t])), [topics]);
  const pillarIndex = useMemo(
    () => new Map(pillars.map((p, i) => [p.id, i])),
    [pillars],
  );

  return (
    <View style={styles.mapCard}>
      {visual.title ? (
        <Text style={[styles.mapTitle, { color: theme.colors.onSurface }]}>{visual.title}</Text>
      ) : null}

      {overview ? (
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: theme.colors.onSurfaceVariant }]}>
            COMPLETE PICTURE
          </Text>
          <Text style={[styles.overview, { color: theme.colors.onSurface }]}>{overview}</Text>
          <View style={styles.chipRow}>
            {pillars.map((p, i) => (
              <View
                key={p.id}
                style={[
                  styles.chip,
                  {
                    borderColor: colors[i % colors.length] + '55',
                    backgroundColor: dark ? 'rgba(255,255,255,0.06)' : 'rgba(26,47,35,0.06)',
                  },
                ]}
              >
                <Text style={[styles.chipText, { color: colors[i % colors.length] }]}>
                  {p.label}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {topics.length > 0 ? (
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: theme.colors.onSurfaceVariant }]}>
            TOPICS IN BRIEF
          </Text>
          {pillars.map((pillar, pi) => {
            const group = topics.filter((t) => t.pillar_id === pillar.id);
            if (!group.length) return null;
            return (
              <View key={pillar.id} style={styles.pillarGroup}>
                <Text style={[styles.pillarTitle, { color: colors[pi % colors.length] }]}>
                  {pillar.label}
                </Text>
                {pillar.summary ? (
                  <Text style={[styles.pillarSummary, { color: theme.colors.onSurfaceVariant }]}>
                    {pillar.summary}
                  </Text>
                ) : null}
                {group.map((topic) => (
                  <View
                    key={topic.id}
                    style={[
                      styles.topicCard,
                      {
                        borderColor: dark ? 'rgba(255,255,255,0.08)' : 'rgba(26,47,35,0.1)',
                        backgroundColor: dark ? 'rgba(255,255,255,0.03)' : '#fff',
                      },
                    ]}
                  >
                    <Text style={[styles.topicLabel, { color: theme.colors.onSurface }]}>
                      {topic.label}
                    </Text>
                    {topic.brief ? (
                      <Text style={[styles.topicBrief, { color: theme.colors.onSurfaceVariant }]}>
                        {topic.brief}
                      </Text>
                    ) : null}
                  </View>
                ))}
              </View>
            );
          })}
        </View>
      ) : null}

      {relations.length > 0 ? (
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: theme.colors.onSurfaceVariant }]}>
            HOW IT CONNECTS
          </Text>
          {relations.map((rel, idx) => {
            const from = topicById.get(rel.from_id);
            const to = topicById.get(rel.to_id);
            const fi = from ? pillarIndex.get(from.pillar_id) ?? 0 : 0;
            const ti = to ? pillarIndex.get(to.pillar_id) ?? 0 : 0;
            return (
              <View key={`${rel.from_id}-${rel.to_id}-${idx}`} style={styles.relationRow}>
                <Text style={[styles.relChip, { color: colors[fi % colors.length] }]}>
                  {from?.label || rel.from_id}
                </Text>
                <Text style={[styles.relLabel, { color: theme.colors.onSurfaceVariant }]}>
                  {(rel.label || '→').toUpperCase()}
                </Text>
                <Text style={[styles.relChip, { color: colors[ti % colors.length] }]}>
                  {to?.label || rel.to_id}
                </Text>
              </View>
            );
          })}
        </View>
      ) : null}

      {sequence.length > 0 ? (
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: theme.colors.onSurfaceVariant }]}>
            PROCESS SPINE
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.seqRow}>
              {sequence.map((step, i) => (
                <React.Fragment key={step.id}>
                  <View
                    style={[
                      styles.seqCard,
                      {
                        borderColor: dark ? 'rgba(255,255,255,0.1)' : 'rgba(26,47,35,0.15)',
                        backgroundColor: dark ? 'rgba(255,255,255,0.04)' : 'rgba(26,47,35,0.04)',
                      },
                    ]}
                  >
                    <Text style={[styles.seqNum, { color: theme.colors.primary }]}>{i + 1}</Text>
                    <Text style={[styles.seqLabel, { color: theme.colors.onSurface }]}>
                      {step.label}
                    </Text>
                    {step.description ? (
                      <Text style={[styles.seqDesc, { color: theme.colors.onSurfaceVariant }]}>
                        {step.description}
                      </Text>
                    ) : null}
                  </View>
                  {i < sequence.length - 1 ? (
                    <Text style={{ color: theme.colors.onSurfaceVariant, alignSelf: 'center' }}>
                      →
                    </Text>
                  ) : null}
                </React.Fragment>
              ))}
            </View>
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
};

const LegacyInlineCard: React.FC<{ visual: VisualItem; theme: any; dark: boolean }> = ({
  visual,
  theme,
  dark,
}) => {
  if (visual.type === 'process_flow') {
    const steps = Array.isArray(visual.data?.steps) ? visual.data.steps : [];
    return (
      <View style={styles.mapCard}>
        {visual.title ? (
          <Text style={[styles.mapTitle, { color: theme.colors.onSurface }]}>{visual.title}</Text>
        ) : null}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.seqRow}>
            {steps.map((step: any, i: number) => (
              <React.Fragment key={step.id || i}>
                <View
                  style={[
                    styles.seqCard,
                    {
                      borderColor: dark ? 'rgba(255,255,255,0.1)' : 'rgba(26,47,35,0.15)',
                      backgroundColor: dark ? 'rgba(255,255,255,0.04)' : 'rgba(26,47,35,0.04)',
                    },
                  ]}
                >
                  <Text style={[styles.seqLabel, { color: theme.colors.onSurface }]}>
                    {step.label}
                  </Text>
                  {step.description ? (
                    <Text style={[styles.seqDesc, { color: theme.colors.onSurfaceVariant }]}>
                      {step.description}
                    </Text>
                  ) : null}
                </View>
                {i < steps.length - 1 ? (
                  <Text style={{ color: theme.colors.onSurfaceVariant, alignSelf: 'center' }}>→</Text>
                ) : null}
              </React.Fragment>
            ))}
          </View>
        </ScrollView>
      </View>
    );
  }

  if (visual.type === 'concept_hierarchy') {
    const nodes = Array.isArray(visual.data?.nodes) ? visual.data.nodes : [];
    const roots = nodes.filter((n: any) => !n.parent_id || n.level === 0);
    const childrenOf = (id: string) => nodes.filter((n: any) => n.parent_id === id);
    const renderNode = (node: any, depth: number) => (
      <View key={node.id} style={{ marginLeft: depth * 12, marginBottom: 8 }}>
        <Text style={[styles.topicLabel, { color: theme.colors.onSurface }]}>{node.label}</Text>
        {node.description ? (
          <Text style={[styles.topicBrief, { color: theme.colors.onSurfaceVariant }]}>
            {node.description}
          </Text>
        ) : null}
        {childrenOf(node.id).map((c: any) => renderNode(c, depth + 1))}
      </View>
    );
    return (
      <View style={styles.mapCard}>
        {visual.title ? (
          <Text style={[styles.mapTitle, { color: theme.colors.onSurface }]}>{visual.title}</Text>
        ) : null}
        {(roots.length ? roots : nodes.slice(0, 1)).map((n: any) => renderNode(n, 0))}
      </View>
    );
  }

  return null;
};

const DiagramTab: React.FC<DiagramTabProps> = ({ contentId, onNavigateToTab }) => {
  const themeMode = useAppTheme();
  const theme = themeMode === 'dark' ? darkTheme : lightTheme;
  const dark = themeMode === 'dark';
  const user = useAuthStore((s) => s.user);
  const { data: contentData, refetch, isLoading } = useContent(contentId);
  const content = contentData?.data as any;
  const visuals: VisualItem[] = Array.isArray(content?.visuals) ? content.visuals : [];

  const [jobId, setJobId] = useState<string | null>(null);
  const [, setError] = useState('');
  const [generating, setGenerating] = useState(false);
  const autoStartedForRef = useRef<number | null>(null);

  const { data: jobStatusData } = useJobStatus(jobId);
  const jobStatus = jobStatusData?.data;
  const jobMissing = Boolean(
    jobId && jobStatusData && jobStatusData.success === false && jobStatusData.message === 'Job not found'
  );

  useEffect(() => {
    const checkPending = async () => {
      if (!user?.id || !contentId || jobId) return;
      try {
        const result = await contentService.getUserJobs(user.id, 'flowchart_generation', contentId);
        if (result.success && result.data) {
          const pending = result.data.find(
            (job: any) => job.status === 'pending' || job.status === 'processing',
          );
          if (pending?.job_id) {
            setJobId(pending.job_id);
            setGenerating(true);
          }
        }
      } catch {

      }
    };
    void checkPending();
  }, [user?.id, contentId, jobId]);

  useEffect(() => {
    if (!jobStatus) return;
    if (jobStatus.status === 'completed') {
      setJobId(null);
      setGenerating(false);
      void refetch();
    } else if (jobStatus.status === 'failed' || jobStatus.status === 'blocked') {
      setJobId(null);
      setGenerating(false);
      setError(jobStatus.user_message || 'Mind map generation failed');
    }
  }, [jobStatus, refetch]);

  useEffect(() => {
    if (!jobMissing) return;
    setJobId(null);
    setGenerating(false);
    void refetch();
  }, [jobMissing, refetch]);

  const handleGenerate = useCallback(async () => {
    if (!user?.id) {
      setError('Sign in to generate a mind map');
      return;
    }
    setError('');
    setGenerating(true);
    try {
      const res = await apiClient.post('/api/v1/materials/generate-flowchart', {
        content_id: contentId,
        user_id: user.id,
      });
      const nextJobId = res.data?.job_id;
      if (nextJobId) {
        setJobId(nextJobId);
      } else {
        setGenerating(false);
        setError('Could not start mind map generation');
      }
    } catch (e: any) {
      setGenerating(false);
      setError(e?.response?.data?.detail || e?.message || 'Generation failed');
    }
  }, [contentId, user?.id]);

  const hasNotes =
    (content?.topics?.length ?? 0) > 0 || (content?.editor_blocks?.length ?? 0) > 0;
  const paper = dark ? STUDY_PAPER_DARK : STUDY_PAPER;

  useEffect(() => {
    if (!hasNotes || generating || jobId || visuals.length > 0 || !user?.id) return;
    if (autoStartedForRef.current === contentId) return;
    autoStartedForRef.current = contentId;
    void handleGenerate();
  }, [contentId, hasNotes, generating, jobId, visuals.length, user?.id, handleGenerate]);

  if (isLoading) {
    return <PanelSkeleton label="Loading mind map" rows={4} />;
  }

  if (generating || jobId) {
    return (
      <StudyGenerationProcessingScreen
        serviceType="flowchart"
        message="Building overview, topics, and relations from your notes…"
        progress={jobStatus?.progress}
      />
    );
  }

  if (!hasNotes) {
    return (
      <View style={[styles.center, { backgroundColor: paper }]}>
        <View style={styles.emptyIcon}>
          <GitBranch size={24} strokeWidth={1.5} color={STUDY_INK} />
        </View>
        <Text style={styles.emptyTitle}>Notes needed first</Text>
        <Text style={styles.emptyBody}>
          Generate notes for this content, then create a mind map from them.
        </Text>
        {onNavigateToTab ? (
          <StudyPillButton label="Go to notes" onPress={onNavigateToTab} />
        ) : null}
      </View>
    );
  }

  if (!visuals.length) {
    return (
      <View style={[styles.center, { backgroundColor: paper }]}>
        <View style={styles.emptyIcon}>
          <GitBranch size={24} strokeWidth={1.5} color={STUDY_INK} />
        </View>
        <Text style={styles.emptyTitle}>Mind map</Text>
        <Text style={styles.emptyBody}>
          Generate a branching overview of topics from your notes.
        </Text>
        <StudyPillButton label="Generate mind map" onPress={handleGenerate} />
      </View>
    );
  }

  const mapVisual = visuals.find((v) => v.type === 'document_map' && Array.isArray(v.data?.pillars));

  return (
    <View style={[styles.flex, { backgroundColor: paper }]}>
      {mapVisual ? (
        <NativeMindMap visual={mapVisual} isDark={dark} />
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          {visuals.map((visual, idx) =>
            visual.type === 'document_map' ? (
              <DocumentMapCard
                key={visual.id || String(idx)}
                visual={visual}
                dark={dark}
                theme={theme}
              />
            ) : (
              <LegacyInlineCard
                key={visual.id || String(idx)}
                visual={visual}
                theme={theme}
                dark={dark}
              />
            ),
          )}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#E8EDE9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontFamily: Fonts.ui.semiBold,
    fontSize: 18,
    letterSpacing: -0.3,
    textAlign: 'center',
    color: STUDY_INK,
  },
  emptyBody: {
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
    color: STUDY_ZINC_500,
    fontFamily: Fonts.ui.regular,
    maxWidth: 360,
  },
  generateBtn: {
    marginTop: 8,
    minWidth: 200,
  },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 20, paddingBottom: 40 },
  mapCard: { gap: 16 },
  mapTitle: {
    fontFamily: Fonts.ui.semiBold,
    fontSize: 18,
  },
  section: { gap: 8 },
  sectionLabel: {
    fontSize: 11,
    fontFamily: Fonts.ui.bold,
    letterSpacing: 0.8,
  },
  overview: {
    fontSize: 15,
    lineHeight: 22,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  chipText: {
    fontSize: 12,
    fontFamily: Fonts.ui.semiBold,
  },
  pillarGroup: { gap: 6, marginTop: 8 },
  pillarTitle: {
    fontSize: 13,
    fontFamily: Fonts.ui.bold,
  },
  pillarSummary: {
    fontSize: 12,
    marginBottom: 4,
  },
  topicCard: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  topicLabel: {
    fontSize: 14,
    fontFamily: Fonts.ui.semiBold,
  },
  topicBrief: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
  relationRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
  },
  relChip: {
    fontSize: 12,
    fontFamily: Fonts.ui.semiBold,
  },
  relLabel: {
    fontSize: 10,
    fontFamily: Fonts.ui.semiBold,
    letterSpacing: 0.4,
  },
  seqRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 8,
  },
  seqCard: {
    width: 140,
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    gap: 2,
  },
  seqNum: {
    fontSize: 10,
    fontFamily: Fonts.ui.bold,
    textTransform: 'uppercase',
  },
  seqLabel: {
    fontSize: 12,
    fontFamily: Fonts.ui.semiBold,
  },
  seqDesc: {
    fontSize: 11,
    lineHeight: 14,
  },
});

export default DiagramTab;
