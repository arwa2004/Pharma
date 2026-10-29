import React, { useEffect, useRef, useState } from "react";
import {
  Box,
  Button,
  Chip,
  IconButton,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import ZoomInIcon from "@mui/icons-material/ZoomIn";
import ZoomOutIcon from "@mui/icons-material/ZoomOut";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import FullscreenIcon from "@mui/icons-material/Fullscreen";
import FullscreenExitIcon from "@mui/icons-material/FullscreenExit";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import ReportProblemIcon from "@mui/icons-material/ReportProblem";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutlined";

export default function PatientKnowledgeGraph({ fiche }) {
  const containerRef = useRef(null);
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDraggingNode, setIsDraggingNode] = useState(null);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Construction du graphe RDF à partir de la fiche
  useEffect(() => {
    if (!fiche) return;

    const width = 800;
    const height = 480;
    const centerX = width / 2;
    const centerY = height / 2;

    const newNodes = [];
    const newEdges = [];

    // 1. Noeud Central : Patient (:Pat_...)
    const patientNodeId = `patient_${fiche.id}`;
    newNodes.push({
      id: patientNodeId,
      label: `${fiche.prenom || ""} ${fiche.nom}`.trim() || fiche.id,
      sublabel: `:${fiche.id}`,
      type: "patient",
      x: centerX,
      y: centerY,
      vx: 0,
      vy: 0,
      radius: 38,
      color: "#065f46",
      bgGradient: ["#047857", "#065f46"],
      icon: "👤",
      raw: fiche,
    });

    // 2. Noeuds Médicaments (:prendMedicament)
    const meds = fiche.medicaments || [];
    const medAngleStep = (2 * Math.PI) / Math.max(meds.length, 1);
    const medRadius = 180;

    meds.forEach((m, idx) => {
      const angle = -Math.PI / 2 + idx * (Math.PI / (meds.length > 1 ? meds.length - 1 : 1)) * 0.8 - 0.4;
      const nx = centerX + Math.cos(angle) * (medRadius + (idx % 2 === 0 ? 0 : 25));
      const ny = centerY - 120 + Math.sin(angle) * 40;
      const nodeId = `med_${m.id}`;

      newNodes.push({
        id: nodeId,
        label: m.nom || m.id,
        sublabel: `:${m.id}`,
        type: "medicament",
        x: nx,
        y: ny,
        vx: 0,
        vy: 0,
        radius: 28,
        color: "#0284c7",
        bgGradient: ["#0284c7", "#0369a1"],
        icon: "💊",
        raw: m,
      });

      newEdges.push({
        id: `edge_pat_med_${m.id}`,
        source: patientNodeId,
        target: nodeId,
        predicate: ":prendMedicament",
        type: "prendMedicament",
        color: "#38bdf8",
        dashed: false,
      });
    });

    // 3. Noeuds Pathologies (:souffreDe)
    const pathas = fiche.pathologies || [];
    pathas.forEach((p, idx) => {
      const angle = Math.PI / 2 + (idx - (pathas.length - 1) / 2) * 0.55;
      const nx = centerX + Math.sin(angle) * 190;
      const ny = centerY + 130 + (idx % 2 === 0 ? 0 : 20);
      const nodeId = `patho_${p.id}`;

      newNodes.push({
        id: nodeId,
        label: p.nom || p.id,
        sublabel: `:${p.id}`,
        type: "pathologie",
        x: nx,
        y: ny,
        vx: 0,
        vy: 0,
        radius: 28,
        color: "#d97706",
        bgGradient: ["#d97706", "#b45309"],
        icon: "🩺",
        raw: p,
      });

      newEdges.push({
        id: `edge_pat_patho_${p.id}`,
        source: patientNodeId,
        target: nodeId,
        predicate: ":souffreDe",
        type: "souffreDe",
        color: "#fbbf24",
        dashed: false,
      });
    });

    // 4. Noeud Médecin (:estSuiviPar)
    if (fiche.medecin) {
      const medecinNodeId = `medecin_${fiche.medecin.id}`;
      newNodes.push({
        id: medecinNodeId,
        label: `Dr. ${fiche.medecin.nom}`,
        sublabel: `:${fiche.medecin.id}`,
        type: "medecin",
        x: centerX - 240,
        y: centerY,
        vx: 0,
        vy: 0,
        radius: 30,
        color: "#7c3aed",
        bgGradient: ["#8b5cf6", "#6d28d9"],
        icon: "👨‍⚕️",
        raw: fiche.medecin,
      });

      newEdges.push({
        id: `edge_pat_medecin`,
        source: patientNodeId,
        target: medecinNodeId,
        predicate: ":estSuiviPar",
        type: "estSuiviPar",
        color: "#a78bfa",
        dashed: false,
      });
    }

    // 5. Relations d'INTERACTIONS DANGEREUSES (en rouge vif !)
    const interactions = fiche.interactions || [];
    interactions.forEach((inter, idx) => {
      const sourceId = `med_${inter.medA}`;
      const targetId = `med_${inter.medB}`;

      newEdges.push({
        id: `edge_interaction_${idx}`,
        source: sourceId,
        target: targetId,
        predicate: "⚠️ INTERACTION DANGEREUSE",
        type: "interaction",
        color: "#dc2626",
        dashed: true,
        width: 3.5,
        details: inter.libelle || "Interaction médicamenteuse majeure",
      });
    });

    // 6. Relations de CONTRE-INDICATIONS (en orange/rouge !)
    const cis = fiche.contre_indications || [];
    cis.forEach((ci, idx) => {
      const sourceId = `med_${ci.med}`;
      const targetId = `patho_${ci.pathologie}`;

      // Seulement si les 2 noeuds existent dans le graphe
      if (newNodes.some((n) => n.id === sourceId) && newNodes.some((n) => n.id === targetId)) {
        newEdges.push({
          id: `edge_ci_${idx}`,
          source: sourceId,
          target: targetId,
          predicate: "⛔ CONTRE-INDICATION",
          type: "contre_indication",
          color: "#ea580c",
          dashed: true,
          width: 3,
          details: ci.libelleCI || "Médicament contre-indiqué pour cette pathologie",
        });
      }
    });

    setNodes(newNodes);
    setEdges(newEdges);
  }, [fiche]);

  // Simulation physique simplifiée pour garder les noeuds bien espacés
  useEffect(() => {
    if (nodes.length <= 1) return;

    let animId;
    let iteration = 0;

    const tick = () => {
      iteration++;
      if (iteration > 40) return; // Stabilisation rapide

      setNodes((prevNodes) => {
        const nextNodes = prevNodes.map((n) => ({ ...n }));
        // Répulsion entre noeuds
        for (let i = 0; i < nextNodes.length; i++) {
          for (let j = i + 1; j < nextNodes.length; j++) {
            const a = nextNodes[i];
            const b = nextNodes[j];
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const dist = Math.hypot(dx, dy) || 1;
            const minDist = (a.radius + b.radius) * 1.8;
            if (dist < minDist) {
              const force = (minDist - dist) / dist * 0.08;
              if (a.type !== "patient") {
                a.x -= dx * force;
                a.y -= dy * force;
              }
              if (b.type !== "patient") {
                b.x += dx * force;
                b.y += dy * force;
              }
            }
          }
        }
        return nextNodes;
      });

      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [edges.length]);

  // Gestion du drag and drop de noeud
  const handleMouseDownNode = (e, node) => {
    e.stopPropagation();
    setIsDraggingNode(node.id);
  };

  const handleMouseMove = (e) => {
    if (isDraggingNode) {
      const rect = containerRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left - pan.x) / zoom;
      const y = (e.clientY - rect.top - pan.y) / zoom;
      setNodes((prev) =>
        prev.map((n) => (n.id === isDraggingNode ? { ...n, x, y } : n))
      );
    } else if (isPanning) {
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDraggingNode(null);
    setIsPanning(false);
  };

  const handleStartPan = (e) => {
    setIsPanning(true);
    setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setSelectedNode(null);
  };

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const hasInteractions = edges.some((e) => e.type === "interaction");
  const hasContreIndications = edges.some((e) => e.type === "contre_indication");

  return (
    <Paper
      elevation={0}
      sx={{
        borderRadius: 3,
        border: hasInteractions ? "2px solid #fca5a5" : "1px solid #e2e8f0",
        bgcolor: "#ffffff",
        overflow: "hidden",
        boxShadow: hasInteractions ? "0 4px 14px rgba(220, 38, 38, 0.08)" : "0 1px 3px rgba(0,0,0,0.04)",
      }}
    >
      {/* Barre d'outils et Titre */}
      <Box
        sx={{
          p: 2,
          px: 2.5,
          borderBottom: "1px solid #f1f5f9",
          bgcolor: "#f8fafc",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 1.5,
        }}
      >
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Typography variant="h6" color="#0f172a" sx={{ fontSize: "1.05rem", fontWeight: 700 }}>
            🕸️ Graphe de Connaissances RDF du Patient
          </Typography>
          {hasInteractions ? (
            <Chip
              size="small"
              icon={<ReportProblemIcon sx={{ fontSize: "15px !important" }} />}
              label="Interaction détectée (en rouge)"
              sx={{ bgcolor: "#fee2e2", color: "#b91c1c", fontWeight: 700, fontSize: "0.78rem" }}
            />
          ) : (
            <Chip
              size="small"
              icon={<CheckCircleOutlineIcon sx={{ fontSize: "15px !important" }} />}
              label="Aucun conflit détecté"
              sx={{ bgcolor: "#f0fdf4", color: "#166534", fontWeight: 700, fontSize: "0.78rem" }}
            />
          )}
          {hasContreIndications && (
            <Chip
              size="small"
              icon={<WarningAmberIcon sx={{ fontSize: "15px !important" }} />}
              label="Contre-indication active"
              sx={{ bgcolor: "#ffedd5", color: "#c2410c", fontWeight: 700, fontSize: "0.78rem" }}
            />
          )}
        </Stack>

        <Stack direction="row" spacing={0.75} alignItems="center">
          <Tooltip title="Zoom avant">
            <IconButton size="small" onClick={() => setZoom((z) => Math.min(z + 0.15, 2))} sx={{ bgcolor: "#ffffff", border: "1px solid #e2e8f0" }}>
              <ZoomInIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Zoom arrière">
            <IconButton size="small" onClick={() => setZoom((z) => Math.max(z - 0.15, 0.5))} sx={{ bgcolor: "#ffffff", border: "1px solid #e2e8f0" }}>
              <ZoomOutIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Réinitialiser la vue">
            <IconButton size="small" onClick={resetView} sx={{ bgcolor: "#ffffff", border: "1px solid #e2e8f0" }}>
              <RestartAltIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title={isFullscreen ? "Réduire" : "Plein écran"}>
            <IconButton size="small" onClick={() => setIsFullscreen(!isFullscreen)} sx={{ bgcolor: "#ffffff", border: "1px solid #e2e8f0" }}>
              {isFullscreen ? <FullscreenExitIcon fontSize="small" /> : <FullscreenIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
        </Stack>
      </Box>

      {/* Zone Canvas SVG */}
      <Box
        ref={containerRef}
        onMouseDown={handleStartPan}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        sx={{
          height: isFullscreen ? "80vh" : 480,
          position: "relative",
          bgcolor: "#fcfdfe",
          backgroundImage: "radial-gradient(#e2e8f0 1.2px, transparent 1.2px)",
          backgroundSize: "22px 22px",
          cursor: isPanning ? "grabbing" : "grab",
          userSelect: "none",
          overflow: "hidden",
        }}
      >
        <svg
          width="100%"
          height="100%"
          style={{ overflow: "visible" }}
        >
          <defs>
            {/* Marqueur de flèche normale */}
            <marker id="arrow" viewBox="0 0 10 10" refX="28" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#94a3b8" />
            </marker>
            {/* Marqueur de flèche interaction rouge */}
            <marker id="arrow-danger" viewBox="0 0 10 10" refX="24" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#dc2626" />
            </marker>
            {/* Marqueur contre-indication orange */}
            <marker id="arrow-ci" viewBox="0 0 10 10" refX="24" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#ea580c" />
            </marker>
          </defs>

          <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
            {/* 1. LIGNES DE RELATIONS (EDGES) */}
            {edges.map((edge) => {
              const source = nodeMap.get(edge.source);
              const target = nodeMap.get(edge.target);
              if (!source || !target) return null;

              const isDanger = edge.type === "interaction";
              const isCi = edge.type === "contre_indication";
              const midX = (source.x + target.x) / 2;
              const midY = (source.y + target.y) / 2;

              // Arc incurvé pour les interactions entre médicaments
              const dx = target.x - source.x;
              const dy = target.y - source.y;
              const curve = isDanger ? -50 : isCi ? 40 : 0;
              const qx = midX + (curve !== 0 ? -dy * 0.2 : 0);
              const qy = midY + (curve !== 0 ? dx * 0.2 : 0);

              return (
                <g key={edge.id}>
                  {/* Trait de l'arc */}
                  <path
                    d={`M ${source.x} ${source.y} Q ${qx} ${qy} ${target.x} ${target.y}`}
                    fill="none"
                    stroke={edge.color}
                    strokeWidth={edge.width || (isDanger ? 3.5 : 2)}
                    strokeDasharray={edge.dashed ? (isDanger ? "8,5" : "5,4") : "none"}
                    markerEnd={isDanger ? "url(#arrow-danger)" : isCi ? "url(#arrow-ci)" : "url(#arrow)"}
                    opacity={selectedNode && selectedNode.id !== source.id && selectedNode.id !== target.id ? 0.25 : 0.9}
                    style={{ transition: "opacity 0.2s" }}
                  />

                  {/* Badge d'interaction ou étiquette du prédicat */}
                  {isDanger ? (
                    <g transform={`translate(${qx}, ${qy})`}>
                      <rect
                        x="-85"
                        y="-15"
                        width="170"
                        height="30"
                        rx="15"
                        fill="#fee2e2"
                        stroke="#dc2626"
                        strokeWidth="1.8"
                        style={{ filter: "drop-shadow(0 2px 5px rgba(220,38,38,0.25))" }}
                      />
                      <text
                        x="0"
                        y="4"
                        fill="#b91c1c"
                        fontSize="11"
                        fontWeight="800"
                        textAnchor="middle"
                        fontFamily="system-ui, sans-serif"
                      >
                        ⚠️ INTERACTION DANGEREUSE
                      </text>
                    </g>
                  ) : isCi ? (
                    <g transform={`translate(${qx}, ${qy})`}>
                      <rect
                        x="-75"
                        y="-14"
                        width="150"
                        height="28"
                        rx="14"
                        fill="#ffedd5"
                        stroke="#ea580c"
                        strokeWidth="1.5"
                      />
                      <text
                        x="0"
                        y="4"
                        fill="#c2410c"
                        fontSize="10.5"
                        fontWeight="800"
                        textAnchor="middle"
                        fontFamily="system-ui, sans-serif"
                      >
                        ⛔ CONTRE-INDICATION
                      </text>
                    </g>
                  ) : (
                    <g transform={`translate(${midX}, ${midY})`}>
                      <rect
                        x="-52"
                        y="-10"
                        width="104"
                        height="20"
                        rx="10"
                        fill="#ffffff"
                        stroke="#cbd5e1"
                        strokeWidth="1"
                        opacity="0.95"
                      />
                      <text
                        x="0"
                        y="3"
                        fill="#64748b"
                        fontSize="9.5"
                        fontWeight="700"
                        textAnchor="middle"
                        fontFamily="monospace"
                      >
                        {edge.predicate}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}

            {/* 2. NOEUDS (NODES) */}
            {nodes.map((node) => {
              const isSelected = selectedNode?.id === node.id;
              const isPatient = node.type === "patient";

              return (
                <g
                  key={node.id}
                  transform={`translate(${node.x}, ${node.y})`}
                  onMouseDown={(e) => handleMouseDownNode(e, node)}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedNode(node);
                  }}
                  style={{ cursor: "pointer" }}
                >
                  {/* Halo pour noeud sélectionné */}
                  {isSelected && (
                    <circle
                      r={node.radius + 8}
                      fill="none"
                      stroke={node.color}
                      strokeWidth="3"
                      strokeDasharray="4,3"
                      opacity="0.8"
                    />
                  )}

                  {/* Cercle principal du noeud */}
                  <circle
                    r={node.radius}
                    fill={node.color}
                    stroke="#ffffff"
                    strokeWidth="3.5"
                    style={{
                      filter: isPatient
                        ? "drop-shadow(0 4px 10px rgba(6,95,70,0.35))"
                        : "drop-shadow(0 2px 6px rgba(0,0,0,0.12))",
                      transition: "transform 0.15s ease",
                    }}
                  />

                  {/* Icône du noeud */}
                  <text
                    x="0"
                    y="5"
                    textAnchor="middle"
                    fontSize={isPatient ? "20" : "15"}
                    style={{ userSelect: "none" }}
                  >
                    {node.icon}
                  </text>

                  {/* Libellé du noeud */}
                  <g transform={`translate(0, ${node.radius + 16})`}>
                    <rect
                      x={-Math.max(node.label.length * 4.2, 35)}
                      y="-12"
                      width={Math.max(node.label.length * 8.4, 70)}
                      height="24"
                      rx="12"
                      fill="#ffffff"
                      stroke="#e2e8f0"
                      strokeWidth="1.2"
                      style={{ filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.06))" }}
                    />
                    <text
                      x="0"
                      y="3.5"
                      fill="#0f172a"
                      fontSize={isPatient ? "12" : "11"}
                      fontWeight="700"
                      textAnchor="middle"
                      fontFamily="system-ui, sans-serif"
                    >
                      {node.label}
                    </text>
                  </g>

                  {/* Identifiant RDF URI */}
                  <text
                    x="0"
                    y={node.radius + 36}
                    fill="#64748b"
                    fontSize="9.5"
                    fontWeight="600"
                    textAnchor="middle"
                    fontFamily="monospace"
                  >
                    {node.sublabel}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>

        {/* Panneau latéral inspecteur du noeud sélectionné */}
        {selectedNode && (
          <Paper
            elevation={3}
            sx={{
              position: "absolute",
              top: 16,
              right: 16,
              width: 280,
              p: 2,
              borderRadius: 2.5,
              bgcolor: "rgba(255,255,255,0.95)",
              backdropFilter: "blur(8px)",
              border: "1px solid #e2e8f0",
              zIndex: 10,
            }}
          >
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 800, color: "#0f172a" }}>
                {selectedNode.icon} {selectedNode.label}
              </Typography>
              <IconButton size="small" onClick={() => setSelectedNode(null)}>
                ×
              </IconButton>
            </Stack>
            <Typography variant="caption" sx={{ fontFamily: "monospace", color: "#64748b", display: "block", mb: 1.5 }}>
              URI : {selectedNode.sublabel}
            </Typography>
            <Typography variant="body2" sx={{ fontSize: "0.82rem", color: "#334155" }}>
              Type ontologique : <strong>:{selectedNode.type}</strong>
            </Typography>
            {selectedNode.type === "patient" && (
              <Box sx={{ mt: 1 }}>
                <Typography variant="caption" color="#64748b" display="block">
                  Âge : <strong>{fiche.age} ans</strong>
                </Typography>
                <Typography variant="caption" color="#64748b" display="block">
                  Médicaments actifs : <strong>{fiche.medicaments?.length || 0}</strong>
                </Typography>
                <Typography variant="caption" color="#64748b" display="block">
                  Pathologies actives : <strong>{fiche.pathologies?.length || 0}</strong>
                </Typography>
              </Box>
            )}
            {selectedNode.type === "medicament" && (
              <Box sx={{ mt: 1 }}>
                <Typography variant="caption" color="#0369a1" display="block">
                  Propriété RDF : <code>:prendMedicament</code>
                </Typography>
              </Box>
            )}
            {selectedNode.type === "pathologie" && (
              <Box sx={{ mt: 1 }}>
                <Typography variant="caption" color="#b45309" display="block">
                  Propriété RDF : <code>:souffreDe</code>
                </Typography>
              </Box>
            )}
          </Paper>
        )}
      </Box>

      {/* Légende sémantique en bas du graphe */}
      <Box
        sx={{
          p: 1.75,
          px: 2.5,
          borderTop: "1px solid #f1f5f9",
          bgcolor: "#f8fafc",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 1.5,
        }}
      >
        <Stack direction="row" spacing={2} alignItems="center" sx={{ flexWrap: "wrap" }}>
          <Stack direction="row" spacing={0.75} alignItems="center">
            <Box sx={{ width: 12, height: 12, borderRadius: "50%", bgcolor: "#065f46" }} />
            <Typography variant="caption" sx={{ color: "#334155", fontWeight: 600 }}>
              Patient (:Patient)
            </Typography>
          </Stack>
          <Stack direction="row" spacing={0.75} alignItems="center">
            <Box sx={{ width: 12, height: 12, borderRadius: "50%", bgcolor: "#0284c7" }} />
            <Typography variant="caption" sx={{ color: "#334155", fontWeight: 600 }}>
              Médicament (:prendMedicament)
            </Typography>
          </Stack>
          <Stack direction="row" spacing={0.75} alignItems="center">
            <Box sx={{ width: 12, height: 12, borderRadius: "50%", bgcolor: "#d97706" }} />
            <Typography variant="caption" sx={{ color: "#334155", fontWeight: 600 }}>
              Maladie (:souffreDe)
            </Typography>
          </Stack>
          <Stack direction="row" spacing={0.75} alignItems="center">
            <Box sx={{ width: 12, height: 12, borderRadius: "50%", bgcolor: "#7c3aed" }} />
            <Typography variant="caption" sx={{ color: "#334155", fontWeight: 600 }}>
              Médecin (:estSuiviPar)
            </Typography>
          </Stack>
          <Stack direction="row" spacing={0.75} alignItems="center">
            <Box sx={{ width: 22, height: 3, bgcolor: "#dc2626", borderTop: "2px dashed #dc2626" }} />
            <Typography variant="caption" sx={{ color: "#b91c1c", fontWeight: 700 }}>
              Interaction dangereuse (en rouge)
            </Typography>
          </Stack>
          <Stack direction="row" spacing={0.75} alignItems="center">
            <Box sx={{ width: 22, height: 3, bgcolor: "#ea580c", borderTop: "2px dashed #ea580c" }} />
            <Typography variant="caption" sx={{ color: "#c2410c", fontWeight: 700 }}>
              Contre-indication (en orange)
            </Typography>
          </Stack>
        </Stack>

        <Typography variant="caption" color="#94a3b8">
          Glissez les bulles pour réorganiser · Molette pour zoomer
        </Typography>
      </Box>
    </Paper>
  );
}
