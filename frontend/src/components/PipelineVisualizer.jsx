import React, { useState, useEffect } from 'react';

export default function PipelineVisualizer({ lastWebhook }) {
  const [activeStep, setActiveStep] = useState(-1);
  const [pulsePayload, setPulsePayload] = useState(null);

  useEffect(() => {
    if (!lastWebhook) return;
    
    // Trigger sequence animation
    setPulsePayload(lastWebhook);
    
    const steps = [0, 1, 2, 3, 4];
    steps.forEach((step, index) => {
      setTimeout(() => {
        setActiveStep(step);
      }, index * 180); // 180ms per step sequence
    });

    // Clear highlight after completion
    setTimeout(() => {
      setActiveStep(-1);
      setPulsePayload(null);
    }, steps.length * 180 + 300);
  }, [lastWebhook]);

  const steps = [
    {
      num: 'Step 01',
      name: 'HTTP Receive',
      sub: pulsePayload ? `${pulsePayload.method} ${pulsePayload.path}` : 'POST /ingest/:id'
    },
    {
      num: 'Step 02',
      name: 'Header parse',
      sub: pulsePayload ? `Parsed ${Object.keys(pulsePayload.headers || {}).length} fields` : 'Extract metadata'
    },
    {
      num: 'Step 03',
      name: 'Body normalize',
      sub: pulsePayload ? 'JSON → JSONB' : 'Save structured doc'
    },
    {
      num: 'Step 04',
      name: 'Ack flush',
      sub: pulsePayload ? `${pulsePayload.latency_ms || 2}ms (202 Accepted)` : '202 Outbound ACK'
    },
    {
      num: 'Step 05',
      name: 'Redis publish',
      sub: pulsePayload ? 'Channel: ep_' + lastWebhook.endpoint_id.slice(3, 8) : 'Pub/Sub queue'
    }
  ];

  return (
    <div>
      <div className="section-label">01 — Webhook Ingestion Pipeline</div>
      <div className="pipeline">
        {steps.map((step, idx) => {
          const isActive = idx === activeStep;
          return (
            <div key={idx} className={`pipeline-step ${isActive ? 'active' : ''}`}>
              {isActive && <div className="pulse-glow"></div>}
              <div className="pipeline-step-num">{step.num}</div>
              <div className="pipeline-step-name">{step.name}</div>
              <div className="pipeline-step-sub" style={isActive ? { color: '#a78bfa' } : {}}>{step.sub}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
