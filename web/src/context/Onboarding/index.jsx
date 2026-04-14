/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import OnboardingOverlay from '../../components/onboarding/OnboardingOverlay';

const ONBOARDING_STORAGE_KEY = 'new_api_onboarding_v1';
const DEFAULT_ONBOARDING_STATE = {
  dismissedAll: false,
  shown: {},
};

function sanitizeOnboardingState(value) {
  return {
    dismissedAll: value?.dismissedAll === true,
    shown:
      value?.shown &&
      typeof value.shown === 'object' &&
      !Array.isArray(value.shown)
        ? value.shown
        : {},
  };
}

function loadOnboardingState() {
  if (typeof window === 'undefined') {
    return DEFAULT_ONBOARDING_STATE;
  }

  try {
    const raw = localStorage.getItem(ONBOARDING_STORAGE_KEY);
    if (!raw) return DEFAULT_ONBOARDING_STATE;
    return sanitizeOnboardingState(JSON.parse(raw));
  } catch (error) {
    return DEFAULT_ONBOARDING_STATE;
  }
}

function persistOnboardingState(value) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(value));
}

function normalizeGuide(guide) {
  if (!guide?.id) return null;

  return {
    placement: 'bottom',
    offset: 16,
    spotlightPadding: 0,
    maxWidth: 320,
    priority: 0,
    ...guide,
    targetId: guide.targetId || guide.id,
  };
}

function isVisibleTarget(target) {
  if (!target || !target.isConnected) return false;
  const rect = target.getBoundingClientRect();
  return (
    rect.width > 0 &&
    rect.height > 0 &&
    rect.bottom > 0 &&
    rect.right > 0 &&
    rect.top < window.innerHeight &&
    rect.left < window.innerWidth
  );
}

function isElementTarget(target) {
  return typeof Element !== 'undefined' && target instanceof Element;
}

function getTargetVisibilityMap(targets) {
  return Object.entries(targets).reduce((result, [targetId, target]) => {
    result[targetId] = isVisibleTarget(target);
    return result;
  }, {});
}

function isSameVisibilityMap(previous, next) {
  const previousKeys = Object.keys(previous);
  const nextKeys = Object.keys(next);

  if (previousKeys.length !== nextKeys.length) {
    return false;
  }

  return nextKeys.every((key) => previous[key] === next[key]);
}

function areGuidesEqual(previous = [], next = []) {
  if (previous.length !== next.length) {
    return false;
  }

  return previous.every((guide, index) => {
    const nextGuide = next[index];
    return (
      guide?.id === nextGuide?.id &&
      guide?.targetId === nextGuide?.targetId &&
      guide?.title === nextGuide?.title &&
      guide?.titleKey === nextGuide?.titleKey &&
      guide?.description === nextGuide?.description &&
      guide?.descriptionKey === nextGuide?.descriptionKey &&
      guide?.placement === nextGuide?.placement &&
      guide?.offset === nextGuide?.offset &&
      guide?.spotlightPadding === nextGuide?.spotlightPadding &&
      guide?.maxWidth === nextGuide?.maxWidth &&
      guide?.priority === nextGuide?.priority
    );
  });
}

export const OnboardingContext = React.createContext({
  state: DEFAULT_ONBOARDING_STATE,
  currentGuide: null,
  registerScope: () => null,
  unregisterScope: () => null,
  registerTarget: () => null,
  unregisterTarget: () => null,
  markGuideShown: () => null,
  dismissAllGuides: () => null,
  resetOnboardingState: () => null,
  openGuide: () => false,
  closeCurrentGuide: () => null,
  setSuppressed: () => null,
});

export const OnboardingProvider = ({ children }) => {
  const [state, setState] = useState(loadOnboardingState);
  const [scopeGuides, setScopeGuides] = useState({});
  const [targets, setTargets] = useState({});
  const [targetVisibility, setTargetVisibility] = useState({});
  const [currentGuideId, setCurrentGuideId] = useState(null);
  const [lastAutoOpenedGuideId, setLastAutoOpenedGuideId] = useState(null);
  const [suppressionMap, setSuppressionMap] = useState({});

  const updateOnboardingState = useCallback((updater) => {
    setState((previous) => {
      const next = sanitizeOnboardingState(
        typeof updater === 'function' ? updater(previous) : updater,
      );
      persistOnboardingState(next);
      return next;
    });
  }, []);

  const registerScope = useCallback((scopeId, guides = []) => {
    const nextGuides = guides.map(normalizeGuide).filter(Boolean);
    setScopeGuides((previous) => {
      if (areGuidesEqual(previous[scopeId], nextGuides)) {
        return previous;
      }

      return {
        ...previous,
        [scopeId]: nextGuides,
      };
    });
  }, []);

  const unregisterScope = useCallback((scopeId) => {
    setScopeGuides((previous) => {
      if (!(scopeId in previous)) return previous;
      const next = { ...previous };
      delete next[scopeId];
      return next;
    });
  }, []);

  const registerTarget = useCallback((targetId, node) => {
    if (!targetId || !node) return;
    setTargets((previous) => {
      if (previous[targetId] === node) return previous;
      return {
        ...previous,
        [targetId]: node,
      };
    });
  }, []);

  const unregisterTarget = useCallback((targetId, node) => {
    setTargets((previous) => {
      if (!previous[targetId]) return previous;
      if (node && previous[targetId] !== node) return previous;
      const next = { ...previous };
      delete next[targetId];
      return next;
    });
  }, []);

  const guides = useMemo(
    () =>
      Object.values(scopeGuides)
        .flat()
        .filter(Boolean)
        .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0)),
    [scopeGuides],
  );

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const targetIds = Object.keys(targets);
    if (targetIds.length === 0) {
      setTargetVisibility((previous) =>
        Object.keys(previous).length === 0 ? previous : {},
      );
      return undefined;
    }

    let frameId = null;
    let resizeObserver = null;

    const updateTargetVisibility = () => {
      frameId = null;
      const nextVisibility = getTargetVisibilityMap(targets);
      setTargetVisibility((previous) =>
        isSameVisibilityMap(previous, nextVisibility)
          ? previous
          : nextVisibility,
      );
    };

    const scheduleTargetVisibilityUpdate = () => {
      if (frameId !== null) {
        return;
      }
      frameId = window.requestAnimationFrame(updateTargetVisibility);
    };

    updateTargetVisibility();
    window.addEventListener('resize', scheduleTargetVisibilityUpdate);
    window.addEventListener('scroll', scheduleTargetVisibilityUpdate, true);
    document.addEventListener(
      'transitionrun',
      scheduleTargetVisibilityUpdate,
      true,
    );
    document.addEventListener(
      'transitionend',
      scheduleTargetVisibilityUpdate,
      true,
    );
    document.addEventListener(
      'transitioncancel',
      scheduleTargetVisibilityUpdate,
      true,
    );
    document.addEventListener(
      'animationstart',
      scheduleTargetVisibilityUpdate,
      true,
    );
    document.addEventListener(
      'animationend',
      scheduleTargetVisibilityUpdate,
      true,
    );

    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        scheduleTargetVisibilityUpdate();
      });

      Object.values(targets).forEach((target) => {
        if (isElementTarget(target)) {
          resizeObserver.observe(target);
        }
      });
    }

    return () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
      resizeObserver?.disconnect();
      window.removeEventListener('resize', scheduleTargetVisibilityUpdate);
      window.removeEventListener(
        'scroll',
        scheduleTargetVisibilityUpdate,
        true,
      );
      document.removeEventListener(
        'transitionrun',
        scheduleTargetVisibilityUpdate,
        true,
      );
      document.removeEventListener(
        'transitionend',
        scheduleTargetVisibilityUpdate,
        true,
      );
      document.removeEventListener(
        'transitioncancel',
        scheduleTargetVisibilityUpdate,
        true,
      );
      document.removeEventListener(
        'animationstart',
        scheduleTargetVisibilityUpdate,
        true,
      );
      document.removeEventListener(
        'animationend',
        scheduleTargetVisibilityUpdate,
        true,
      );
    };
  }, [targets]);

  const eligibleGuides = useMemo(() => {
    if (state.dismissedAll || Object.keys(suppressionMap).length > 0) return [];

    return guides.filter((guide) => {
      if (state.shown[guide.id]) return false;
      return targetVisibility[guide.targetId] === true;
    });
  }, [
    guides,
    state.dismissedAll,
    state.shown,
    suppressionMap,
    targetVisibility,
  ]);

  const currentGuide = useMemo(() => {
    if (!currentGuideId) return null;
    return guides.find((guide) => guide.id === currentGuideId) || null;
  }, [currentGuideId, guides]);

  const currentTarget = currentGuide ? targets[currentGuide.targetId] : null;
  const isCurrentGuideVisible = currentGuide
    ? targetVisibility[currentGuide.targetId] === true
    : false;

  useEffect(() => {
    if (
      currentGuideId &&
      (!currentGuide ||
        state.dismissedAll ||
        Object.keys(suppressionMap).length > 0 ||
        state.shown[currentGuideId] ||
        !isCurrentGuideVisible)
    ) {
      setCurrentGuideId(null);
    }
  }, [
    currentGuide,
    currentGuideId,
    isCurrentGuideVisible,
    state.dismissedAll,
    state.shown,
    suppressionMap,
  ]);

  useEffect(() => {
    if (eligibleGuides.length === 0) {
      setLastAutoOpenedGuideId(null);
      return;
    }

    if (currentGuideId) {
      return;
    }

    const nextGuideId = eligibleGuides[0].id;
    if (nextGuideId === lastAutoOpenedGuideId) {
      return;
    }

    setCurrentGuideId(nextGuideId);
    setLastAutoOpenedGuideId(nextGuideId);
  }, [currentGuideId, eligibleGuides, lastAutoOpenedGuideId]);

  const markGuideShown = useCallback(
    (guideId) => {
      if (!guideId) return;
      updateOnboardingState((previous) => ({
        ...previous,
        shown: {
          ...previous.shown,
          [guideId]: true,
        },
      }));
    },
    [updateOnboardingState],
  );

  const dismissAllGuides = useCallback(() => {
    updateOnboardingState((previous) => ({
      ...previous,
      dismissedAll: true,
    }));
    setCurrentGuideId(null);
  }, [updateOnboardingState]);

  const resetOnboardingState = useCallback(() => {
    updateOnboardingState(DEFAULT_ONBOARDING_STATE);
    setCurrentGuideId(null);
    setLastAutoOpenedGuideId(null);
  }, [updateOnboardingState]);

  const closeCurrentGuide = useCallback(() => {
    setCurrentGuideId(null);
  }, []);

  const setSuppressed = useCallback((key, suppressed) => {
    if (!key) return;

    setSuppressionMap((previous) => {
      const isSuppressed = suppressed === true;
      const hadKey = previous[key] === true;

      if (isSuppressed === hadKey) {
        return previous;
      }

      if (isSuppressed) {
        return {
          ...previous,
          [key]: true,
        };
      }

      const next = { ...previous };
      delete next[key];
      return next;
    });
  }, []);

  const openGuide = useCallback(
    (guideId) => {
      const targetGuide = guides.find((guide) => guide.id === guideId);
      if (
        !targetGuide ||
        state.dismissedAll ||
        Object.keys(suppressionMap).length > 0 ||
        state.shown[guideId]
      ) {
        return false;
      }
      if (targetVisibility[targetGuide.targetId] !== true) {
        return false;
      }
      setCurrentGuideId(guideId);
      setLastAutoOpenedGuideId(guideId);
      return true;
    },
    [guides, state.dismissedAll, state.shown, suppressionMap, targetVisibility],
  );

  const handleConfirmCurrentGuide = useCallback(() => {
    if (!currentGuideId) return;
    markGuideShown(currentGuideId);
    setCurrentGuideId(null);
  }, [currentGuideId, markGuideShown]);

  const contextValue = useMemo(
    () => ({
      state,
      currentGuide,
      registerScope,
      unregisterScope,
      registerTarget,
      unregisterTarget,
      markGuideShown,
      dismissAllGuides,
      resetOnboardingState,
      openGuide,
      closeCurrentGuide,
      setSuppressed,
    }),
    [
      state,
      currentGuide,
      registerScope,
      unregisterScope,
      registerTarget,
      unregisterTarget,
      markGuideShown,
      dismissAllGuides,
      resetOnboardingState,
      openGuide,
      closeCurrentGuide,
      setSuppressed,
    ],
  );

  return (
    <OnboardingContext.Provider value={contextValue}>
      {children}
      {Object.keys(suppressionMap).length === 0 && (
        <OnboardingOverlay
          guide={currentGuide}
          target={currentTarget}
          onConfirm={handleConfirmCurrentGuide}
          onDismissAll={dismissAllGuides}
        />
      )}
    </OnboardingContext.Provider>
  );
};
