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

import React, { useMemo } from 'react';
import { useHeaderBar } from '../../../hooks/common/useHeaderBar';
import { useNotifications } from '../../../hooks/common/useNotifications';
import { useNavigation } from '../../../hooks/common/useNavigation';
import {
  useOnboardingScope,
  useOnboardingTarget,
} from '../../../hooks/common/useOnboarding';
import NoticeModal from '../NoticeModal';
import MobileMenuButton from './MobileMenuButton';
import HeaderLogo from './HeaderLogo';
import Navigation from './Navigation';
import ActionButtons from './ActionButtons';

const MOBILE_MENU_GUIDE_ID = 'mobile_console_menu_button';
const MODEL_MARKET_GUIDE_ID = 'header_model_market';

const HeaderBar = ({ onMobileMenuToggle, drawerOpen }) => {
  const {
    userState,
    statusState,
    isMobile,
    collapsed,
    logoLoaded,
    currentLang,
    isLoading,
    systemName,
    logo,
    isNewYear,
    isSelfUseMode,
    docsLink,
    modelStatusLink,
    isDemoSiteMode,
    isConsoleRoute,
    theme,
    headerNavModules,
    pricingRequireAuth,
    logout,
    handleLanguageChange,
    handleThemeToggle,
    handleMobileMenuToggle,
    navigate,
    t,
  } = useHeaderBar({ onMobileMenuToggle, drawerOpen });

  const {
    noticeVisible,
    unreadCount,
    handleNoticeOpen,
    handleNoticeClose,
    getUnreadKeys,
  } = useNotifications(statusState);

  const { mainNavLinks } = useNavigation(
    t,
    docsLink,
    headerNavModules,
    modelStatusLink,
  );

  const guides = useMemo(() => {
    const nextGuides = [];

    if (mainNavLinks.some((link) => link.itemKey === 'pricing')) {
      nextGuides.push({
        id: MODEL_MARKET_GUIDE_ID,
        targetId: MODEL_MARKET_GUIDE_ID,
        title: '模型广场',
        description:
          '这里可以查到所有模型与具体价格哦，本站点1r=站内100额度，宝宝们自行换算。首页可以看到售后群，我们每周会放模型打折投票与不定期福利。',
        placement: 'bottom',
        maxWidth: isMobile ? 300 : 360,
        priority: 300,
      });
    }

    if (isConsoleRoute && isMobile) {
      nextGuides.push({
        id: MOBILE_MENU_GUIDE_ID,
        targetId: MOBILE_MENU_GUIDE_ID,
        title: '点击后可查看其他数据页面',
        placement: 'bottom',
        maxWidth: 260,
        priority: 200,
      });
    }

    return nextGuides;
  }, [isConsoleRoute, isMobile, mainNavLinks]);

  useOnboardingScope(guides);
  const onboardingTargetProps = useOnboardingTarget(MOBILE_MENU_GUIDE_ID);
  const modelMarketTargetProps = useOnboardingTarget(MODEL_MARKET_GUIDE_ID);

  return (
    <header className='text-semi-color-text-0 sticky top-0 z-50 transition-colors duration-300 bg-white/75 dark:bg-zinc-900/75 backdrop-blur-lg'>
      <NoticeModal
        visible={noticeVisible}
        onClose={handleNoticeClose}
        isMobile={isMobile}
        defaultTab={unreadCount > 0 ? 'system' : 'inApp'}
        unreadKeys={getUnreadKeys()}
      />

      <div className='w-full px-2'>
        <div className='flex items-center justify-between h-16'>
          <div className='flex items-center'>
            <MobileMenuButton
              isConsoleRoute={isConsoleRoute}
              isMobile={isMobile}
              drawerOpen={drawerOpen}
              collapsed={collapsed}
              onToggle={handleMobileMenuToggle}
              onboardingTargetProps={onboardingTargetProps}
              t={t}
            />

            <HeaderLogo
              isMobile={isMobile}
              isConsoleRoute={isConsoleRoute}
              logo={logo}
              logoLoaded={logoLoaded}
              isLoading={isLoading}
              systemName={systemName}
              isSelfUseMode={isSelfUseMode}
              isDemoSiteMode={isDemoSiteMode}
              t={t}
            />
          </div>

          <Navigation
            mainNavLinks={mainNavLinks}
            isMobile={isMobile}
            isLoading={isLoading}
            userState={userState}
            pricingRequireAuth={pricingRequireAuth}
            onboardingTargetPropsByItemKey={{
              pricing: modelMarketTargetProps,
            }}
          />

          <ActionButtons
            isNewYear={isNewYear}
            unreadCount={unreadCount}
            onNoticeOpen={handleNoticeOpen}
            theme={theme}
            onThemeToggle={handleThemeToggle}
            currentLang={currentLang}
            onLanguageChange={handleLanguageChange}
            userState={userState}
            isLoading={isLoading}
            isMobile={isMobile}
            isSelfUseMode={isSelfUseMode}
            logout={logout}
            navigate={navigate}
            t={t}
          />
        </div>
      </div>
    </header>
  );
};

export default HeaderBar;
