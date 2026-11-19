import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import type { FormEvent } from "react";
import { POLL_LIMITS } from "../../shared/constants";
import type { CreatePollPayload } from "../../shared/types";
import { ApiError } from "../lib/api";
import { fromDateTimeLocalValue, toDateTimeLocalValue } from "../lib/format";
import {
  Button,
  Card,
  Field,
  Input,
  Spinner,
  Switch,
  Textarea,
} from "./ui";

export interface PollFormInitial {
  title: string;
  description: string;
  options: string[];
  maxChoices: number;
  deadlineAt: number | null;
  isListed: boolean;
}

interface PollFormProps {
  initial?: PollFormInitial;
  submitLabel: string;
  contentLocked?: boolean;
  lockedNote?: string;
  onSubmit: (payload: CreatePollPayload) => Promise<void>;
}

const emptyInitial: PollFormInitial = {
  title: "",
  description: "",
  options: ["", ""],
  maxChoices: 1,
  deadlineAt: null,
  isListed: false,
};

export function PollForm({
  initial = emptyInitial,
  submitLabel,
  contentLocked = false,
  lockedNote,
  onSubmit,
}: PollFormProps) {
  const [title, setTitle] = useState(initial.title);
  const [description, setDescription] = useState(initial.description);
  const [options, setOptions] = useState<string[]>(
    initial.options.length >= POLL_LIMITS.minOptions
      ? initial.options
      : ["", ""],
  );
  const [maxChoices, setMaxChoices] = useState(initial.maxChoices);
  const [deadlineValue, setDeadlineValue] = useState(
    toDateTimeLocalValue(initial.deadlineAt),
  );
  const [isListed, setIsListed] = useState(initial.isListed);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const initialDeadlineValue = toDateTimeLocalValue(initial.deadlineAt);

  function updateOption(index: number, value: string) {
    setOptions((current) =>
      current.map((option, optionIndex) =>
        optionIndex === index ? value : option,
      ),
    );
  }

  function addOption() {
    if (options.length >= POLL_LIMITS.maxOptions) {
      return;
    }
    setOptions((current) => [...current, ""]);
  }

  function removeOption(index: number) {
    if (options.length <= POLL_LIMITS.minOptions) {
      return;
    }
    const next = options.filter((_, optionIndex) => optionIndex !== index);
    setOptions(next);
    setMaxChoices((current) => Math.min(current, next.length));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (contentLocked) {
      try {
        setSubmitting(true);
        await onSubmit({
          title: initial.title,
          description: initial.description,
          options: initial.options,
          maxChoices: initial.maxChoices,
          deadlineAt: initial.deadlineAt,
          isListed,
        });
      } catch (submitError) {
        setError(
          submitError instanceof Error ? submitError.message : "保存失败",
        );
      } finally {
        setSubmitting(false);
      }
      return;
    }

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError("请填写投票标题");
      return;
    }

    const trimmedOptions = options.map((option) => option.trim());
    if (trimmedOptions.some((option) => !option)) {
      setError("选项不能为空");
      return;
    }
    if (trimmedOptions.length < POLL_LIMITS.minOptions) {
      setError(`至少需要 ${POLL_LIMITS.minOptions} 个选项`);
      return;
    }
    if (
      maxChoices < 1 ||
      maxChoices > trimmedOptions.length ||
      !Number.isInteger(maxChoices)
    ) {
      setError(`最多可选数需要在 1 到 ${trimmedOptions.length} 之间`);
      return;
    }

    const deadlineAt = fromDateTimeLocalValue(deadlineValue);
    if (deadlineValue && deadlineAt === null) {
      setError("截止时间格式不正确");
      return;
    }
    const deadlineUnchanged = deadlineValue === initialDeadlineValue;
    if (
      deadlineAt !== null &&
      !deadlineUnchanged &&
      deadlineAt <= Date.now() + 30_000
    ) {
      setError("截止时间至少要在 30 秒之后");
      return;
    }

    try {
      setSubmitting(true);
      await onSubmit({
        title: trimmedTitle,
        description: description.trim(),
        options: trimmedOptions,
        maxChoices,
        deadlineAt,
        isListed,
      });
    } catch (submitError) {
      setError(
        submitError instanceof ApiError
          ? submitError.message
          : "保存失败，请稍后再试",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      onInput={() => {
        if (error) {
          setError("");
        }
      }}
      className="space-y-4 sm:space-y-5"
    >
      {contentLocked && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {lockedNote ?? "已有投票，投票内容已锁定。"}
        </div>
      )}

      <Card className="space-y-5 p-5 sm:p-6">
        <Field
          label="投票标题"
          htmlFor="poll-title"
          hint={`${title.length}/${POLL_LIMITS.title}`}
        >
          <Input
            id="poll-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={POLL_LIMITS.title}
            placeholder="例如：这周五团建去哪里？"
            disabled={contentLocked}
          />
        </Field>

        <Field
          label="补充说明（可选）"
          htmlFor="poll-description"
          hint={`${description.length}/${POLL_LIMITS.description}`}
        >
          <Textarea
            id="poll-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={POLL_LIMITS.description}
            rows={3}
            placeholder="补充一点背景信息，让大家更好做决定…"
            disabled={contentLocked}
          />
        </Field>
      </Card>

      <Card className="space-y-4 p-5 sm:p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">选项</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              至少 {POLL_LIMITS.minOptions} 个，最多 {POLL_LIMITS.maxOptions}{" "}
              个
            </p>
          </div>
          <span className="text-xs tabular-nums text-slate-400">
            {options.length}/{POLL_LIMITS.maxOptions}
          </span>
        </div>

        <div className="space-y-2.5">
          {options.map((option, index) => (
            <div key={index} className="flex items-center gap-2">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-xs font-semibold text-slate-500">
                {index + 1}
              </span>
              <Input
                value={option}
                onChange={(event) =>
                  updateOption(index, event.target.value)
                }
                maxLength={POLL_LIMITS.optionLabel}
                placeholder={`选项 ${index + 1}`}
                disabled={contentLocked}
                aria-label={`选项 ${index + 1}`}
              />
              <button
                type="button"
                onClick={() => removeOption(index)}
                disabled={
                  contentLocked || options.length <= POLL_LIMITS.minOptions
                }
                className="grid size-10 shrink-0 place-items-center rounded-lg text-slate-500 transition hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label={`删除选项 ${index + 1}`}
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
        </div>

        <Button
          variant="secondary"
          size="sm"
          onClick={addOption}
          disabled={
            contentLocked || options.length >= POLL_LIMITS.maxOptions
          }
        >
          <Plus className="size-4" />
          添加选项
        </Button>
      </Card>

      <Card className="space-y-5 p-5 sm:p-6">
        <Field
          label="最多可选几项"
          htmlFor="poll-max-choices"
          hint="1 表示单选；大于 1 表示多选"
        >
          <Input
            id="poll-max-choices"
            type="number"
            min={1}
            max={options.length}
            value={maxChoices}
            onChange={(event) =>
              setMaxChoices(Math.trunc(Number(event.target.value)))
            }
            disabled={contentLocked}
          />
        </Field>

        <Field
          label="截止时间（可选）"
          htmlFor="poll-deadline"
          hint="留空表示长期开放，直到你在后台手动截止"
        >
          <Input
            id="poll-deadline"
            type="datetime-local"
            value={deadlineValue}
            onChange={(event) => setDeadlineValue(event.target.value)}
            disabled={contentLocked}
          />
        </Field>

        <Switch
          checked={isListed}
          onChange={setIsListed}
          label="公开到首页"
          description="开启后，进行中的投票会出现在首页列表；关闭则只有拿到链接的人可见。"
        />
      </Card>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      <div className="flex justify-end">
        <Button
          type="submit"
          size="lg"
          className="w-full sm:w-auto"
          disabled={submitting}
        >
          {submitting ? (
            <>
              <Spinner className="size-4 text-white" />
              保存中
            </>
          ) : (
            submitLabel
          )}
        </Button>
      </div>
    </form>
  );
}
