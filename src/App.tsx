import { useEffect, useState } from 'react';
import { AgendaProvider } from './state/AgendaContext';
import { AuthProvider, useAuth } from './state/AuthContext';
import AuthScreen from './components/AuthScreen';
import { STORAGE_KEY } from './lib/constants';
import Header, { type ViewMode } from './components/Header';
import AnnualView from './components/AnnualView';
import WeeklyView from './components/WeeklyView';
import StudentsView from './components/StudentsView';
import FinanceView from './components/FinanceView';
import StatsView from './components/StatsView';
import DayAgendaModal from './components/DayAgendaModal';
import ClassFormModal from './components/ClassFormModal';
import GlobalSearchModal from './components/GlobalSearchModal';
import SettingsModal from './components/SettingsModal';
import StudentProfileModal from './components/StudentProfileModal';
import StudentFormModal from './components/StudentFormModal';
import PaymentFormModal from './components/PaymentFormModal';
import MoveClassModal from './components/MoveClassModal';
import DuplicateClassModal from './components/DuplicateClassModal';
import CopyWeekModal from './components/CopyWeekModal';
import BlockDayModal from './components/BlockDayModal';
import UndoToast from './components/UndoToast';
import ExportReminder from './components/ExportReminder';
import Skeletons from './components/Skeletons';
import SyncCheck from './components/SyncCheck';
import Spinner from './components/Spinner';
import ReminderEditModal from './components/ReminderEditModal';
import RemindersPanel from './components/RemindersPanel';
import { useReminders } from './hooks/useReminders';
import { useAgenda } from './state/AgendaContext';
import { startOfWeek } from './lib/date';
import type { ClassEntry, ClassFormTarget, Student } from './types';

/** Orquesta qué vista y qué modal está abierto; el estado de datos vive en AgendaContext. */
function AppShell() {
  const { initialLoading, data } = useAgenda();
  const { due, upcoming, dueCount } = useReminders();
  const [view, setView] = useState<ViewMode>('anual');
  const [reminderTarget, setReminderTarget] = useState<{ day: string; hour: number } | null>(null);
  const [remindersOpen, setRemindersOpen] = useState(false);
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [weekAnchor, setWeekAnchor] = useState(() => new Date());
  const [openDay, setOpenDay] = useState<string | null>(null);
  const [formTarget, setFormTarget] = useState<ClassFormTarget | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [editStudent, setEditStudent] = useState<Student | null>(null);
  // Pago abierto desde la agenda del día (atado a una clase).
  const [payTarget, setPayTarget] = useState<{ studentId: string; classRef: { day: string; hour: number } } | null>(
    null
  );
  const [moveTarget, setMoveTarget] = useState<{ day: string; hour: number } | null>(null);
  const [duplicateTarget, setDuplicateTarget] = useState<{ day: string; hour: number } | null>(null);
  const [copyWeekMonday, setCopyWeekMonday] = useState<Date | null>(null);
  const [blockDayKey, setBlockDayKey] = useState<string | null>(null);

  function openNewClass(day: string, hour: number) {
    setFormTarget({ day, hour, entry: null });
  }
  function openEditClass(day: string, hour: number, entry: ClassEntry) {
    setFormTarget({ day, hour, entry });
  }

  return (
    <div className="app">
      <Header
        view={view}
        onChangeView={setView}
        year={year}
        onChangeYear={setYear}
        onOpenSearch={() => setSearchOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
        reminderCount={dueCount}
        onOpenReminders={() => setRemindersOpen(true)}
      />

      <ExportReminder />

      <main className="app__content">
        {initialLoading && Object.keys(data.days).length === 0 && Object.keys(data.students).length === 0 ? (
          <Skeletons />
        ) : (
          // `key={view}` remonta el contenido al cambiar de pestaña → transición suave.
          <div className="view-anim" key={view}>
            {view === 'anual' && <AnnualView year={year} onOpenDay={setOpenDay} />}
            {view === 'semanal' && (
              <WeeklyView
                anchor={weekAnchor}
                onChangeAnchor={setWeekAnchor}
                onOpenNewClass={openNewClass}
                onOpenEditClass={openEditClass}
                onOpenCopyWeek={(fromMonday) => setCopyWeekMonday(fromMonday)}
                onBlockDay={(day) => setBlockDayKey(day)}
              />
            )}
            {view === 'alumnos' && <StudentsView onOpenDay={setOpenDay} />}
            {view === 'caja' && <FinanceView onOpenStudent={setProfileId} />}
            {view === 'stats' && <StatsView onGoCaja={() => setView('caja')} />}
          </div>
        )}
      </main>

      {openDay && (
        <DayAgendaModal
          day={openDay}
          onClose={() => setOpenDay(null)}
          onNewClass={(hour) => openNewClass(openDay, hour)}
          onEditClass={(hour, entry) => openEditClass(openDay, hour, entry)}
          onRegisterPayment={(studentId, classRef) => setPayTarget({ studentId, classRef })}
          onMoveClass={(hour) => setMoveTarget({ day: openDay, hour })}
          onDuplicateClass={(hour) => setDuplicateTarget({ day: openDay, hour })}
          onReminder={(hour) => setReminderTarget({ day: openDay, hour })}
          onBlockDay={() => setBlockDayKey(openDay)}
        />
      )}

      {formTarget && (
        <ClassFormModal
          target={formTarget}
          onClose={() => setFormTarget(null)}
          onReminder={() => setReminderTarget({ day: formTarget.day, hour: formTarget.hour })}
        />
      )}

      {searchOpen && (
        <GlobalSearchModal
          onClose={() => setSearchOpen(false)}
          onOpenStudent={(id) => {
            setSearchOpen(false);
            setProfileId(id);
          }}
          onOpenDay={(day) => {
            setSearchOpen(false);
            setOpenDay(day);
          }}
        />
      )}

      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}

      {profileId && (
        <StudentProfileModal
          studentId={profileId}
          onClose={() => setProfileId(null)}
          onEdit={(student) => setEditStudent(student)}
          onOpenDay={(day) => {
            setProfileId(null);
            setOpenDay(day);
          }}
        />
      )}

      {editStudent && <StudentFormModal student={editStudent} onClose={() => setEditStudent(null)} />}

      {payTarget && (
        <PaymentFormModal
          studentId={payTarget.studentId}
          classRef={payTarget.classRef}
          onClose={() => setPayTarget(null)}
        />
      )}

      {moveTarget && <MoveClassModal from={moveTarget} onClose={() => setMoveTarget(null)} />}

      {duplicateTarget && (
        <DuplicateClassModal from={duplicateTarget} onClose={() => setDuplicateTarget(null)} />
      )}

      {copyWeekMonday && (
        <CopyWeekModal fromMonday={startOfWeek(copyWeekMonday)} onClose={() => setCopyWeekMonday(null)} />
      )}

      {blockDayKey && <BlockDayModal day={blockDayKey} onClose={() => setBlockDayKey(null)} />}

      {reminderTarget && (
        <ReminderEditModal
          day={reminderTarget.day}
          hour={reminderTarget.hour}
          onClose={() => setReminderTarget(null)}
        />
      )}

      {remindersOpen && (
        <RemindersPanel due={due} upcoming={upcoming} onOpenDay={setOpenDay} onClose={() => setRemindersOpen(false)} />
      )}

      <UndoToast />
      <SyncCheck />
    </div>
  );
}

/** Portero (Tanda 6): sin sesión muestra el login; con sesión, la app sincronizada. */
function Root() {
  const { session, loading } = useAuth();

  // Aplica el tema guardado (claro/oscuro) también en el login, antes de cargar la app.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const theme = raw ? (JSON.parse(raw)?.settings?.theme as string | undefined) : undefined;
      document.documentElement.setAttribute('data-theme', theme === 'light' ? 'light' : 'dark');
    } catch {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  }, []);

  if (loading) {
    return (
      <div className="auth-screen">
        <div className="auth-card auth-card--loading">
          <Spinner label="Cargando…" />
        </div>
      </div>
    );
  }

  if (!session) return <AuthScreen />;

  return (
    <AgendaProvider>
      <AppShell />
    </AgendaProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Root />
    </AuthProvider>
  );
}
