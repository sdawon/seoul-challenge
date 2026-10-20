import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { Spacing } from '@/constants/theme';
import { useSession } from '@/providers/session-provider';

/** S1 시작 (DESIGN.md §5.2) */
export function Start() {
  const { signInAnonymously } = useSession();
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  async function start() {
    setLoading(true);
    setFailed(false);
    try {
      await signInAnonymously();
      // 성공하면 세션이 바뀌면서 라우트 가드가 온보딩으로 보낸다.
    } catch {
      setFailed(true);
      setLoading(false);
    }
  }

  return (
    <Screen
      scroll={false}
      footer={
        <View style={styles.footer}>
          {failed && (
            <AppText variant="caption" color="error" style={styles.center}>
              연결이 원활하지 않아요. 다시 시도해 주세요.
            </AppText>
          )}
          <Button label="시작하기" onPress={start} loading={loading} />
        </View>
      }>
      <View style={styles.hero}>
        <AppText variant="display" style={styles.center}>
          MY서울루틴
        </AppText>
        <AppText color="slate" style={styles.center}>
          Maru · 하루 5분, 서울에서 해보는 작은 루틴
        </AppText>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    flex: 1,
    justifyContent: 'center',
    gap: Spacing.xs,
  },
  center: {
    textAlign: 'center',
  },
  footer: {
    gap: Spacing.xs,
  },
});
