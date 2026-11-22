import { zodResolver } from "@hookform/resolvers/zod";
import { Download, RotateCcw } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/Button";
import { SectionCard } from "@/components/ui/Card";
import { Field, Input, Select, Switch, Textarea } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { Segmented } from "@/components/ui/Segmented";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { useApi } from "@/hooks/useApi";
import { useSettings, type ThemePreference } from "@/hooks/useSettings";
import { API_BASE_URL, getErrorMessage } from "@/services/api";
import { exportData, getSystemInfo } from "@/services/system";
import { formatNumber, plural } from "@/utils/format";

const gymSchema = z.object({
  gymName: z.string().trim().min(1, "Enter your gym’s name").max(60, "Keep the name under 60 characters"),
  address: z.string().trim().max(200, "Keep the address under 200 characters"),
  phone: z
    .string()
    .trim()
    .refine((v) => v === "" || /^\+?\d{10,13}$/.test(v.replace(/[\s\-()]/g, "")), "Enter 10 to 13 digits (optional leading +)"),
  email: z
    .string()
    .trim()
    .refine((v) => v === "" || z.string().email().safeParse(v).success, "Enter a valid email address"),
});
type GymValues = z.infer<typeof gymSchema>;

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 py-2.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
      <dt className="text-label text-fg2">{label}</dt>
      <dd className="min-w-0 break-all text-sm sm:text-right">{children}</dd>
    </div>
  );
}

export default function SettingsPage() {
  const toast = useToast();
  const { settings, update, reset } = useSettings();
  const info = useApi((s) => getSystemInfo(s), []);
  const [exporting, setExporting] = useState(false);

  const {
    register,
    handleSubmit,
    reset: resetForm,
    formState: { errors, isDirty },
  } = useForm<GymValues>({
    resolver: zodResolver(gymSchema),
    defaultValues: { gymName: settings.gymName, address: settings.address, phone: settings.phone, email: settings.email },
  });

  const saveGym = handleSubmit((values) => {
    update(values);
    resetForm(values);
    toast.success("Gym information saved");
  });

  const download = async () => {
    setExporting(true);
    try {
      const { blob, filename } = await exportData();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${filename}`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setExporting(false);
    }
  };

  const d = info.data;

  return (
    <>
      <PageHeader title="Settings" description="Gym details, appearance and data." />

      <div className="grid gap-4 xl:grid-cols-2">
        <SectionCard title="Gym information" description="Shown in the sidebar and dashboard. Saved in this browser.">
          <form onSubmit={saveGym} noValidate className="grid gap-4 sm:grid-cols-2">
            <Field label="Gym name" htmlFor="st-name" required error={errors.gymName?.message} className="sm:col-span-2">
              <Input id="st-name" invalid={!!errors.gymName} {...register("gymName")} />
            </Field>
            <Field label="Contact number" htmlFor="st-phone" error={errors.phone?.message}>
              <Input id="st-phone" type="tel" placeholder="Optional" invalid={!!errors.phone} {...register("phone")} />
            </Field>
            <Field label="Email" htmlFor="st-email" error={errors.email?.message}>
              <Input id="st-email" type="email" placeholder="Optional" invalid={!!errors.email} {...register("email")} />
            </Field>
            <Field label="Address" htmlFor="st-address" error={errors.address?.message} className="sm:col-span-2">
              <Textarea id="st-address" rows={2} placeholder="Optional" invalid={!!errors.address} {...register("address")} />
            </Field>
            <div className="flex justify-end sm:col-span-2">
              <Button type="submit" variant="primary" disabled={!isDirty}>
                Save changes
              </Button>
            </div>
          </form>
        </SectionCard>

        <SectionCard title="Preferences" description="These apply to this browser only.">
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Theme</p>
                <p className="text-meta text-muted">“System” follows your device setting.</p>
              </div>
              <Segmented<ThemePreference>
                label="Theme"
                value={settings.theme}
                onChange={(theme) => update({ theme })}
                options={[
                  { value: "dark", label: "Dark" },
                  { value: "light", label: "Light" },
                  { value: "system", label: "System" },
                ]}
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Rows per page</p>
                <p className="text-meta text-muted">For the members and payments tables.</p>
              </div>
              <Select aria-label="Rows per page" wrapperClassName="w-28" value={settings.pageSize} onChange={(e) => update({ pageSize: Number(e.target.value) })}>
                {[10, 20, 50].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Compact sidebar</p>
                <p className="text-meta text-muted">Show icons only on large screens.</p>
              </div>
              <Switch label="Compact sidebar" checked={settings.sidebarCollapsed} onChange={(sidebarCollapsed) => update({ sidebarCollapsed })} />
            </div>
            <div className="border-t border-line pt-4">
              <Button
                onClick={() => {
                  reset();
                  resetForm({ gymName: "My Gym", address: "", phone: "", email: "" });
                  toast.info("Preferences reset to defaults");
                }}
              >
                <RotateCcw className="h-4 w-4" /> Reset preferences
              </Button>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Application" description="Version and connection details.">
          <dl className="divide-y divide-line">
            <InfoRow label="Application">Forma · Gym Management System</InfoRow>
            <InfoRow label="API version">{d ? <span className="num">{d.version}</span> : <Skeleton className="ml-auto h-4 w-16" />}</InfoRow>
            <InfoRow label="Backend URL">
              <span className="num">{API_BASE_URL}</span>
            </InfoRow>
            <InfoRow label="Expiry warning window">{d ? plural(d.expiry_warning_days, "day") : <Skeleton className="ml-auto h-4 w-16" />}</InfoRow>
          </dl>
          {info.error && <p role="alert" className="mt-2 text-label text-err">{info.error}</p>}
          <p className="mt-3 text-meta text-muted">The expiry window is set on the server with GYM_EXPIRY_WARNING_DAYS. Payments here are records only; no real transactions are processed.</p>
        </SectionCard>

        <SectionCard title="Data management" description="Where your records live and how to back them up.">
          <dl className="divide-y divide-line">
            <InfoRow label="Storage">JSON files on the server</InfoRow>
            <InfoRow label="Location">{d ? <span className="num">{d.data_dir}</span> : <Skeleton className="ml-auto h-4 w-48" />}</InfoRow>
            <InfoRow label="Records">
              {d ? (
                <span className="num">
                  {formatNumber(d.counts.members)} members · {formatNumber(d.counts.plans)} plans · {formatNumber(d.counts.payments)} payments
                </span>
              ) : (
                <Skeleton className="ml-auto h-4 w-48" />
              )}
            </InfoRow>
          </dl>
          <p className="mt-3 text-meta text-muted">Writes are atomic, so a crash can’t leave a half-written file. If a file is ever corrupted it’s moved aside with a “.corrupt” suffix rather than deleted.</p>
          <div className="mt-4">
            <Button onClick={() => void download()} loading={exporting}>
              <Download className="h-4 w-4" /> Export all data (JSON)
            </Button>
          </div>
        </SectionCard>
      </div>
    </>
  );
}
