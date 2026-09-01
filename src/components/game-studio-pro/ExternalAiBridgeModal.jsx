// Xưởng Game Pro — PRO 4: EXTERNAL AI BRIDGE UI
//
// Giao diện trao đổi kịch bản giữa FictionWorld và các AI bên ngoài (ChatGPT, Claude, Gemini, DeepSeek...)
// Gồm 4 chức năng:
// 1. Sao chép prompt (Copy Prompt)
// 2. Nhập kịch bản (Import, Validate, Fail-Closed Entity Approval & Final Validation)
// 3. Xuất kịch bản (Export Blueprint to DSL)
// 4. Xem định dạng (Format Docs & Cheat Sheet)
import React, { useState, useMemo } from "react";
import {
  Sparkles,
  Copy,
  Check,
  Download,
  AlertTriangle,
  XCircle,
  CheckCircle2,
  FileText,
  HelpCircle,
  RefreshCw,
  Flag,
  Package,
  Heart,
  BarChart3,
  PlusCircle,
  Link2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import {
  parseAndValidateProScript,
  finalizeAndValidateProScript,
  serializeEpisodeBlueprint,
  generateExternalAiPrompt,
  generateRepairPrompt,
  SCRIPT_HEADER_V1,
  SCRIPT_FORMAT_DOCS,
} from "@/lib/gameStudioPro/scriptBridge";
import { SCENE_ROLE_LABELS } from "@/lib/gameStudioPro/blueprintModel";
import { listEntities } from "@/lib/gameStudioPro/entityRegistry";

export default function ExternalAiBridgeModal({
  open,
  onClose,
  episode,
  gamePlan,
  blueprint,
  onApplyBlueprint,
  mechanics,
  templateId,
}) {
  const [activeTab, setActiveTab] = useState("copy_prompt");
  const { toast } = useToast();

  // Tab 1: Prompt Generator State
  const [promptMode, setPromptMode] = useState("full_episode");
  const [selectedSceneId, setSelectedSceneId] = useState(blueprint?.scenes?.[0]?.id || "");
  const [customInstructions, setCustomInstructions] = useState("");
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  // Tab 2: Import, Entity Approval & Final Validation State
  const [pastedScript, setPastedScript] = useState("");
  const [inspection, setInspection] = useState(null);
  const [entityApprovals, setEntityApprovals] = useState({}); // { [tempKey]: { action: "create" | "map", targetEntityId?: string } }
  const [copiedRepair, setCopiedRepair] = useState(false);

  // Tab 3: Export State
  const [copiedExport, setCopiedExport] = useState(false);

  const scenes = blueprint?.scenes || [];

  // Tính toán Prompt tự động khi tuỳ chọn thay đổi
  const generatedPrompt = useMemo(() => {
    return generateExternalAiPrompt({
      mode: promptMode,
      gamePlan,
      episode,
      blueprint,
      selectedSceneId,
      customInstructions,
      mechanics,
      templateId,
    });
  }, [promptMode, gamePlan, episode, blueprint, selectedSceneId, customInstructions, mechanics, templateId]);

  // Tính toán Script xuất bản từ Blueprint hiện tại
  const exportedScript = useMemo(() => {
    return serializeEpisodeBlueprint(blueprint, episode);
  }, [blueprint, episode]);

  async function handleCopy(text, setCopiedFlag, label = "đã sao chép") {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedFlag(true);
      setTimeout(() => setCopiedFlag(false), 2000);
      toast({ title: `Đã sao chép ${label}` });
    } catch (e) {
      toast({ variant: "destructive", title: "Không thể sao chép tự động", description: "Nội dung vẫn ở ô bên dưới để bạn chọn và sao chép thủ công." });
    }
  }

  function handleCheckScript() {
    if (!pastedScript.trim()) {
      toast({ variant: "destructive", title: "Chưa có nội dung", description: "Hãy dán kịch bản từ AI vào ô văn bản." });
      return;
    }

    const result = parseAndValidateProScript(pastedScript, {
      episodeId: episode?.id || "ep_1",
      existingRegistry: blueprint?.registry || null,
    });

    setInspection(result);
    setEntityApprovals({});

    if (result.entityProposals.length > 0) {
      toast({
        title: "Kịch bản có thực thể mới cần duyệt",
        description: `Phát hiện ${result.entityProposals.length} thực thể mới/chưa có trong danh mục. Hãy duyệt bên dưới.`,
      });
    } else if (result.validation.valid) {
      toast({
        title: "Kịch bản hợp lệ!",
        description: `Đã phân tích thành công ${result.validation.stats.sceneCount} cảnh, ${result.validation.stats.choiceCount} lựa chọn.`,
      });
    } else {
      toast({
        variant: "destructive",
        title: "Phát hiện lỗi trong kịch bản",
        description: `Có ${result.validation.errors.length} lỗi cần khắc phục. Xem chi tiết bên dưới.`,
      });
    }
  }

  function handleApproveAllDeclared() {
    if (!inspection) return;
    const next = { ...entityApprovals };
    for (const prop of inspection.entityProposals || []) {
      if (prop.declaredInHeader) {
        next[prop.tempKey] = { action: "create" };
      }
    }
    setEntityApprovals(next);
    toast({ title: "Đã chọn tạo tất cả thực thể được khai báo" });
  }

  function handleSetApproval(tempKey, decision) {
    setEntityApprovals((prev) => ({ ...prev, [tempKey]: decision }));
  }

  const pendingProposalsCount = useMemo(() => {
    if (!inspection || !inspection.entityProposals) return 0;
    return inspection.entityProposals.filter((p) => !entityApprovals[p.tempKey]).length;
  }, [inspection, entityApprovals]);

  // Giai đoạn 2: Tự động tính toán Finalized Blueprint & Post-Validation khi đã duyệt hết proposals
  const finalizationResult = useMemo(() => {
    if (!inspection || !inspection.blueprint) return null;
    if (pendingProposalsCount > 0) return null;

    return finalizeAndValidateProScript({
      normalizedResult: inspection,
      approvals: entityApprovals,
      existingRegistry: blueprint?.registry || null,
      episodeId: episode?.id || "ep_1",
    });
  }, [inspection, entityApprovals, pendingProposalsCount, blueprint?.registry, episode?.id]);

  const activeValidation = useMemo(() => {
    if (finalizationResult) return finalizationResult.validation;
    return inspection?.validation;
  }, [finalizationResult, inspection]);

  const canImport = useMemo(() => {
    return !!finalizationResult?.validation?.readyToImport;
  }, [finalizationResult]);

  function handleApplyImport() {
    if (!finalizationResult || !finalizationResult.finalizedBlueprint || !canImport) return;

    if (blueprint?.scenes?.length > 0) {
      const confirmOverwrite = window.confirm(
        `Tập "${episode?.title || "này"}" đã có ${blueprint.scenes.length} cảnh trong sơ đồ.\n\nNhập kịch bản mới sẽ THAY THẾ toàn bộ sơ đồ hiện tại của tập này.\n\nBạn có chắc chắn muốn thay thế?`
      );
      if (!confirmOverwrite) return;
    }

    onApplyBlueprint(finalizationResult.finalizedBlueprint);
    toast({
      title: "Đã nhập kịch bản vào Xưởng Game Pro!",
      description: `Đã nạp ${finalizationResult.finalizedBlueprint.scenes.length} cảnh và ${finalizationResult.finalizedBlueprint.endings.length} kết thúc.`,
    });
    onClose();
  }

  function handleCopyRepairPrompt() {
    if (!activeValidation) return;
    const repairPrompt = generateRepairPrompt({
      validationIssues: activeValidation.errors,
      originalScript: pastedScript,
    });
    handleCopy(repairPrompt, setCopiedRepair, "yêu cầu sửa lỗi cho AI");
  }

  function handleDownloadExport() {
    try {
      const blob = new Blob([exportedScript], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${episode?.title || "kich_ban"}_pro_script.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast({ title: "Đã tải file kịch bản .txt" });
    } catch (e) {
      toast({ variant: "destructive", title: "Không thể tải file", description: e.message });
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <DialogTitle className="text-lg">Viết bằng AI bên ngoài</DialogTitle>
          </div>
          <DialogDescription className="text-xs">
            Sao chép hướng dẫn, đưa cho ChatGPT / Claude / Gemini, rồi dán kết quả lại đây. Bạn không cần biết cấu trúc kỹ thuật.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-4">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <div className="overflow-x-auto"><TabsList className="grid grid-cols-4 min-w-[560px] w-full">
              <TabsTrigger value="copy_prompt" className="text-xs flex items-center gap-1.5">
                <Copy className="w-3.5 h-3.5" /> Sao chép prompt
              </TabsTrigger>
              <TabsTrigger value="import_script" className="text-xs flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" /> Nhập kịch bản
              </TabsTrigger>
              <TabsTrigger value="export_script" className="text-xs flex items-center gap-1.5">
                <Download className="w-3.5 h-3.5" /> Xuất kịch bản
              </TabsTrigger>
              <TabsTrigger value="format_docs" className="text-xs flex items-center gap-1.5">
                <HelpCircle className="w-3.5 h-3.5" /> Nâng cao
              </TabsTrigger>
            </TabsList></div>

            {/* TAB 1: SAO CHÉP PROMPT */}
            <TabsContent value="copy_prompt" className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Chế độ viết của AI</Label>
                  <Select value={promptMode} onValueChange={setPromptMode}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="full_episode">Tạo toàn bộ tập (Kịch bản hoàn chỉnh)</SelectItem>
                      <SelectItem value="continue_from_scene" disabled={scenes.length === 0}>
                        Viết tiếp từ một cảnh có sẵn
                      </SelectItem>
                      <SelectItem value="rewrite_scene" disabled={scenes.length === 0}>
                        Thiết kế lại một cảnh
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {(promptMode === "continue_from_scene" || promptMode === "rewrite_scene") && (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Cảnh được chọn</Label>
                    <Select value={selectedSceneId} onValueChange={setSelectedSceneId}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Chọn cảnh..." /></SelectTrigger>
                      <SelectContent>
                        {scenes.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.title || "(chưa đặt tên)"} ({SCENE_ROLE_LABELS[s.role] || s.role})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Yêu cầu bổ sung của bạn (Tuỳ chọn)</Label>
                <Input
                  className="h-8 text-xs"
                  placeholder="Ví dụ: Tập trung vào màn đấu trí gay gắt với Hoàng hậu, thêm 1 cảnh nguy hiểm..."
                  value={customInstructions}
                  onChange={(e) => setCustomInstructions(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-muted-foreground">Bước 1 · Hướng dẫn gửi cho AI</Label>
                  <Button
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => handleCopy(generatedPrompt, setCopiedPrompt, "Prompt AI")}
                  >
                    {copiedPrompt ? <Check className="w-3.5 h-3.5 mr-1" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                    {copiedPrompt ? "Đã sao chép!" : "Sao chép prompt cho AI"}
                  </Button>
                </div>
                <Textarea
                  readOnly
                  rows={10}
                  className="font-mono text-[11px] bg-muted/30"
                  value={generatedPrompt}
                />
              </div>
            </TabsContent>

            {/* TAB 2: NHẬP KỊCH BẢN */}
            <TabsContent value="import_script" className="space-y-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold">
                    Bước 2 · Dán kết quả AI vào đây
                  </Label>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => setPastedScript("")}
                    disabled={!pastedScript}
                  >
                    Xoá nội dung
                  </Button>
                </div>
                <Textarea
                  rows={8}
                  className="font-mono text-xs"
                  placeholder={`Dán kịch bản vào đây...\nVí dụ:\n${SCRIPT_HEADER_V1}\n\nTẬP: Nhập cung\n...\nCẢNH: Yến tiệc\nLOẠI: Lựa chọn\n...`}
                  value={pastedScript}
                  onChange={(e) => setPastedScript(e.target.value)}
                />
              </div>

              <div className="flex items-center justify-between gap-2">
                <Button size="sm" onClick={handleCheckScript} disabled={!pastedScript.trim()}>
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Bước 3 · Kiểm tra kịch bản
                </Button>

                {inspection && canImport && (
                  <Button size="sm" variant="default" onClick={handleApplyImport}>
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Bước 5 · Nhập vào tập
                  </Button>
                )}

                {inspection && !canImport && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleCopyRepairPrompt}
                    disabled={!activeValidation || activeValidation.errors.length === 0}
                  >
                    {copiedRepair ? <Check className="w-3.5 h-3.5 mr-1" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                    {copiedRepair ? "Đã sao chép yêu cầu sửa!" : "Sao chép yêu cầu sửa lỗi cho AI"}
                  </Button>
                )}
              </div>

              {/* KẾT QUẢ KIỂM TRA & DUYỆT THỰC THỂ */}
              {inspection && (
                <div className="space-y-3 rounded-xl border border-border bg-card p-3">
                  {/* Summary Bar */}
                  <div className="flex flex-wrap items-center gap-3 text-xs">
                    <span className="font-semibold">Bước 4 · Xem trước:</span>
                    <Badge variant={canImport ? "default" : "destructive"}>
                      {canImport
                        ? "✓ Sẵn sàng nhập"
                        : pendingProposalsCount > 0
                        ? `⚠ Cần duyệt ${pendingProposalsCount} dữ liệu mới`
                        : activeValidation?.errors?.length > 0
                        ? `✕ ${activeValidation.errors.length} lỗi sơ đồ`
                        : "Chưa hoàn tất"}
                    </Badge>
                    {activeValidation?.warnings?.length > 0 && (
                      <Badge variant="secondary" className="text-amber-600 bg-amber-500/10">
                        ⚠ {activeValidation.warnings.length} cảnh báo
                      </Badge>
                    )}
                    <span className="text-muted-foreground">
                      {activeValidation?.stats?.sceneCount || inspection.blueprint?.scenes?.length || 0} cảnh · {activeValidation?.stats?.choiceCount || 0} lựa chọn · {activeValidation?.stats?.endingCount || 0} kết thúc
                    </span>
                  </div>

                  {/* SECTION DUYỆT THỰC THỂ (Entity Proposals Approval) */}
                  {inspection.entityProposals?.length > 0 && (
                    <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-xs font-semibold text-primary flex items-center gap-1.5">
                            <PlusCircle className="w-4 h-4" /> Duyệt thực thể mới ({inspection.entityProposals.length})
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            Kịch bản sử dụng các thực thể chưa có trong danh mục. Hãy chọn tạo mới hoặc ánh xạ vào thực thể có sẵn:
                          </p>
                        </div>
                        {inspection.entityProposals.some((p) => p.declaredInHeader) && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs shrink-0"
                            onClick={handleApproveAllDeclared}
                          >
                            <Check className="w-3 h-3 mr-1" /> Chấp nhận tất cả khai báo
                          </Button>
                        )}
                      </div>

                      <div className="space-y-2 max-h-56 overflow-y-auto">
                        {inspection.entityProposals.map((prop) => {
                          const approval = entityApprovals[prop.tempKey];
                          const pool = listEntities(blueprint?.registry || { stats: [], flags: [], items: [] }, prop.kind);

                          return (
                            <div
                              key={prop.tempKey}
                              className="rounded-lg border border-border bg-background p-2 text-xs space-y-1.5"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1.5">
                                  {prop.kind === "relationship" ? (
                                    <Heart className="w-3.5 h-3.5 text-pink-500" />
                                  ) : prop.kind === "flag" ? (
                                    <Flag className="w-3.5 h-3.5 text-emerald-500" />
                                  ) : prop.kind === "item" ? (
                                    <Package className="w-3.5 h-3.5 text-amber-500" />
                                  ) : (
                                    <BarChart3 className="w-3.5 h-3.5 text-blue-500" />
                                  )}
                                  <strong className="text-foreground">{prop.requestedName}</strong>
                                  <span className="text-[10px] text-muted-foreground">({prop.usage})</span>
                                </div>
                                {approval ? (
                                  <Badge variant="outline" className="text-emerald-600 border-emerald-500/30 text-[10px]">
                                    ✓ {approval.action === "create" ? "Tạo mới" : "Ánh xạ"}
                                  </Badge>
                                ) : (
                                  <Badge variant="destructive" className="text-[10px]">Chờ duyệt</Badge>
                                )}
                              </div>

                              <div className="flex flex-wrap items-center gap-2 pt-1">
                                <Button
                                  size="sm"
                                  variant={approval?.action === "create" ? "default" : "outline"}
                                  className="h-6 text-[11px]"
                                  onClick={() => handleSetApproval(prop.tempKey, { action: "create" })}
                                >
                                  <PlusCircle className="w-3 h-3 mr-1" /> Tạo {prop.kind === "flag" ? "cờ" : prop.kind === "item" ? "vật phẩm" : prop.kind === "relationship" ? "quan hệ" : "chỉ số"} "{prop.requestedName}"
                                </Button>

                                {prop.candidates?.map((cand) => (
                                  <Button
                                    key={cand.id}
                                    size="sm"
                                    variant={approval?.action === "map" && approval.targetEntityId === cand.id ? "default" : "outline"}
                                    className="h-6 text-[11px]"
                                    onClick={() => handleSetApproval(prop.tempKey, { action: "map", targetEntityId: cand.id })}
                                  >
                                    <Link2 className="w-3 h-3 mr-1" /> Dùng "{cand.displayName}" có sẵn
                                  </Button>
                                ))}

                                {pool.length > 0 && !prop.candidates?.length && (
                                  <Select
                                    value={approval?.action === "map" ? approval.targetEntityId : ""}
                                    onValueChange={(tid) => handleSetApproval(prop.tempKey, { action: "map", targetEntityId: tid })}
                                  >
                                    <SelectTrigger className="h-6 text-[11px] w-48"><SelectValue placeholder="Chọn thực thể có sẵn..." /></SelectTrigger>
                                    <SelectContent>
                                      {pool.map((e) => (
                                        <SelectItem key={e.id} value={e.id}>{e.displayName}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Lỗi chi tiết (Pre-validation hoặc Post-validation) */}
                  {activeValidation?.errors?.length > 0 && (
                    <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-2.5 space-y-1">
                      <p className="text-xs font-semibold text-destructive">Cần sửa trước khi nhập:</p>
                      {activeValidation.errors.map((err, i) => (
                        <p key={i} className="text-xs text-destructive flex items-start gap-1.5">
                          <XCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                          <span>{err.line > 0 ? `Dòng ${err.line}: ` : ""}{err.message}</span>
                        </p>
                      ))}
                    </div>
                  )}

                  {/* Cảnh báo chi tiết */}
                  {activeValidation?.warnings?.length > 0 && (
                    <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-2.5 space-y-1">
                      <p className="text-xs font-semibold text-amber-700">Cảnh báo:</p>
                      {activeValidation.warnings.map((warn, i) => (
                        <p key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-500" />
                          <span>{warn.line > 0 ? `Dòng ${warn.line}: ` : ""}{warn.message}</span>
                        </p>
                      ))}
                    </div>
                  )}

                  {/* Danh sách cảnh xem trước */}
                  {inspection.blueprint?.scenes?.length > 0 && (
                    <div className="space-y-1.5 text-xs">
                      <p className="font-semibold text-muted-foreground">Sơ đồ phân cảnh sẽ tạo:</p>
                      <div className="max-h-40 overflow-y-auto rounded-lg border border-border p-2 space-y-1 bg-muted/20">
                        {inspection.blueprint.scenes.map((s, idx) => (
                          <div key={s.id} className="flex items-center justify-between text-[11px]">
                            <span className="truncate">
                              {idx + 1}. <Badge variant="secondary" className="text-[10px] mr-1">{SCENE_ROLE_LABELS[s.role] || s.role}</Badge>
                              <strong>{s.title}</strong>
                            </span>
                            <span className="text-muted-foreground text-[10px] shrink-0">
                              {s.choices.length} lựa chọn
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>

            {/* TAB 3: XUẤT KỊCH BẢN */}
            <TabsContent value="export_script" className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">
                  Kịch bản hiện tại của tập "{episode?.title || "Tập 1"}" ({blueprint?.scenes?.length || 0} cảnh):
                </Label>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={handleDownloadExport}
                  >
                    <Download className="w-3.5 h-3.5 mr-1" /> Tải file .txt
                  </Button>
                  <Button
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => handleCopy(exportedScript, setCopiedExport, "Kịch bản")}
                  >
                    {copiedExport ? <Check className="w-3.5 h-3.5 mr-1" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                    {copiedExport ? "Đã sao chép!" : "Sao chép"}
                  </Button>
                </div>
              </div>

              <Textarea
                readOnly
                rows={12}
                className="font-mono text-xs bg-muted/30"
                value={exportedScript}
              />
            </TabsContent>

            {/* TAB 4: ĐỊNH DẠNG */}
            <TabsContent value="format_docs" className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Hướng dẫn định dạng FICTIONWORLD PRO SCRIPT v1</Label>
                <Textarea
                  readOnly
                  rows={14}
                  className="font-mono text-[11px] bg-muted/20 leading-relaxed"
                  value={SCRIPT_FORMAT_DOCS}
                />
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
