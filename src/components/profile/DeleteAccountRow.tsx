import React from 'react';
import ConfirmModal from '@/components/ui/ConfirmModal';
import SettingsListRow from '@/components/profile/SettingsListRow';
import { useDeleteAccount } from '@/hooks/useDeleteAccount';
import { lightTheme } from '@/theme';

type DeleteAccountRowProps = {
  theme: typeof lightTheme;
};

const DeleteAccountRow: React.FC<DeleteAccountRowProps> = ({ theme }) => {
  const {
    open,
    isOpening,
    confirmVisible,
    confirmMessage,
    closeConfirm,
    confirmDelete,
    isDeleting,
    blockedVisible,
    blockedReason,
    closeBlocked,
    goToBilling,
  } = useDeleteAccount();

  return (
    <>
      <SettingsListRow
        icon="trash-can-outline"
        label={isOpening ? 'Checking account…' : 'Delete account'}
        onPress={() => {
          void open();
        }}
        disabled={isOpening || isDeleting}
        showChevron={false}
        tone="danger"
        theme={theme}
      />
      <ConfirmModal
        visible={confirmVisible}
        title="Delete account"
        message={confirmMessage}
        confirmText="Delete account"
        cancelText="Cancel"
        onConfirm={() => {
          void confirmDelete();
        }}
        onCancel={closeConfirm}
        isLoading={isDeleting}
        loadingText="Deleting..."
        destructive
      />
      <ConfirmModal
        visible={blockedVisible}
        title="Cancel subscription first"
        message={blockedReason}
        confirmText="Manage subscription"
        cancelText="Not now"
        onConfirm={goToBilling}
        onCancel={closeBlocked}
      />
    </>
  );
};

export default DeleteAccountRow;
