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

import { useCallback, useContext, useEffect, useId, useRef } from 'react';
import { OnboardingContext } from '../../context/Onboarding';

export function useOnboarding() {
  return useContext(OnboardingContext);
}

export function useOnboardingScope(guides = []) {
  const { registerScope, unregisterScope } = useOnboarding();
  const scopeId = useId();
  const normalizedGuides = guides.filter(Boolean);
  const guidesSignature = JSON.stringify(
    normalizedGuides.map((guide) => ({
      id: guide?.id ?? null,
      targetId: guide?.targetId ?? null,
      title: guide?.title ?? null,
      titleKey: guide?.titleKey ?? null,
      description: guide?.description ?? null,
      descriptionKey: guide?.descriptionKey ?? null,
      placement: guide?.placement ?? null,
      offset: guide?.offset ?? null,
      spotlightPadding: guide?.spotlightPadding ?? null,
      maxWidth: guide?.maxWidth ?? null,
      priority: guide?.priority ?? null,
    })),
  );

  useEffect(() => {
    registerScope(scopeId, normalizedGuides);
    return () => unregisterScope(scopeId);
  }, [guidesSignature, registerScope, scopeId, unregisterScope]);
}

export function useOnboardingTarget(targetId) {
  const { registerTarget, unregisterTarget } = useOnboarding();
  const lastNodeRef = useRef(null);

  const ref = useCallback(
    (node) => {
      if (lastNodeRef.current && lastNodeRef.current !== node) {
        unregisterTarget(targetId, lastNodeRef.current);
      }

      if (node) {
        registerTarget(targetId, node);
      }

      lastNodeRef.current = node;
    },
    [registerTarget, targetId, unregisterTarget],
  );

  useEffect(
    () => () => {
      if (lastNodeRef.current) {
        unregisterTarget(targetId, lastNodeRef.current);
      }
    },
    [targetId, unregisterTarget],
  );

  return {
    ref,
    'data-onboarding-target': targetId,
  };
}

export function useOnboardingSuppressed(key, suppressed) {
  const { setSuppressed } = useOnboarding();

  useEffect(() => {
    if (!key || typeof setSuppressed !== 'function') {
      return undefined;
    }

    setSuppressed(key, suppressed);

    return () => {
      setSuppressed(key, false);
    };
  }, [key, setSuppressed, suppressed]);
}
