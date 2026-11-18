<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{{ $order->code() }} · {{ $company->displayName() }}</title>
    <style>
        :root { --primary: #4361ee; --border: #d9dce6; --muted: #5b6070; }
        * { box-sizing: border-box; }
        body { font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; font-size: 14px; color: #1f2330; margin: 0; padding: 24px; background: #fff; }
        .sheet { max-width: 820px; margin: 0 auto; }
        header { display: flex; justify-content: space-between; gap: 16px; border-bottom: 2px solid var(--primary); padding-bottom: 12px; margin-bottom: 16px; }
        h1 { font-size: 20px; margin: 0 0 4px; }
        .muted { color: var(--muted); }
        .code { text-align: right; }
        .code strong { font-size: 18px; display: block; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 24px; margin-bottom: 16px; }
        .box { border: 1px solid var(--border); border-radius: 6px; padding: 10px 12px; }
        .label { font-size: 12px; color: var(--muted); text-transform: uppercase; letter-spacing: .03em; }
        table { width: 100%; border-collapse: collapse; margin-top: 8px; }
        th, td { border-bottom: 1px solid var(--border); padding: 6px 4px; text-align: left; vertical-align: top; }
        th { font-size: 12px; color: var(--muted); text-transform: uppercase; }
        .num { text-align: right; white-space: nowrap; }
        .totals { margin-left: auto; width: 260px; margin-top: 8px; }
        .totals td { border: 0; padding: 3px 4px; }
        .totals .grand td { font-weight: 700; font-size: 16px; border-top: 1px solid var(--border); }
        .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 56px; }
        .signatures div { border-top: 1px solid #1f2330; padding-top: 6px; text-align: center; }
        .note { font-size: 12px; color: var(--muted); margin-top: 16px; }
        .actions { text-align: right; margin-bottom: 12px; }
        .actions button { background: var(--primary); color: #fff; border: 0; border-radius: 6px; padding: 8px 14px; font-size: 14px; cursor: pointer; }
        @media print { body { padding: 0; } .actions { display: none; } }
        @media (max-width: 600px) { .grid { grid-template-columns: 1fr; } header { flex-direction: column; } .code { text-align: left; } }
    </style>
</head>
<body>
<div class="sheet">
    <div class="actions"><button type="button" onclick="window.print()">Imprimir</button></div>

    <header>
        <div>
            <h1>{{ $company->displayName() }}</h1>
            <div class="muted">RUC {{ $company->ruc }} · {{ $company->billingSettings?->fiscal_address }}</div>
            @if ($company->phone)<div class="muted">Tel. {{ $company->phone }}</div>@endif
        </div>
        <div class="code">
            <span class="label">Orden de trabajo</span>
            <strong>{{ $order->code() }}</strong>
            <span class="muted">{{ $order->status->label() }}</span>
        </div>
    </header>

    <div class="grid">
        <div class="box">
            <div class="label">Cliente</div>
            <div><strong>{{ $order->customer->name }}</strong></div>
            <div class="muted">{{ $order->customer->documentLabel() }}@if ($order->customer->phone) · {{ $order->customer->phone }}@endif</div>
        </div>
        <div class="box">
            <div class="label">Vehículo</div>
            <div><strong>{{ $order->vehicle->formattedPlate() }}</strong> · {{ $order->vehicle->brand }} {{ $order->vehicle->model }} {{ $order->vehicle->year }}</div>
            <div class="muted">Km de ingreso: {{ $order->mileage_in !== null ? number_format($order->mileage_in, 0, '.', ',') : '—' }}@if ($order->vehicle->color) · {{ $order->vehicle->color }}@endif</div>
        </div>
        <div class="box">
            <div class="label">Ingreso</div>
            <div>{{ $order->received_at->timezone(config('app.timezone'))->format('d/m/Y H:i') }}</div>
            @if ($order->promised_at)<div class="muted">Entrega prometida: {{ $order->promised_at->format('d/m/Y') }}</div>@endif
        </div>
        <div class="box">
            <div class="label">Técnico</div>
            <div>{{ $order->assignedUser?->name ?? '—' }}</div>
        </div>
    </div>

    <div class="box" style="margin-bottom: 12px">
        <div class="label">Problema reportado</div>
        <div>{!! nl2br(e($order->reported_problem)) !!}</div>
    </div>
    @if ($order->diagnosis)
        <div class="box" style="margin-bottom: 12px">
            <div class="label">Diagnóstico</div>
            <div>{!! nl2br(e($order->diagnosis)) !!}</div>
        </div>
    @endif

    <table>
        <thead>
        <tr><th>Descripción</th><th class="num">Cant.</th><th class="num">P. unit.</th><th class="num">Importe</th></tr>
        </thead>
        <tbody>
        @forelse ($order->items as $item)
            <tr>
                <td>{{ $item->description }}<div class="muted">{{ \App\Models\WorkOrderItem::TYPES[$item->type] ?? $item->type }}</div></td>
                <td class="num">{{ rtrim(rtrim(number_format((float) $item->quantity, 3, '.', ','), '0'), '.') }} {{ $item->unit }}</td>
                <td class="num">S/ {{ number_format((float) $item->unit_price, 2, '.', ',') }}</td>
                <td class="num">S/ {{ number_format((float) $item->total, 2, '.', ',') }}</td>
            </tr>
        @empty
            <tr><td colspan="4" class="muted">Sin servicios ni repuestos registrados.</td></tr>
        @endforelse
        </tbody>
    </table>

    <table class="totals">
        <tr><td>Op. gravada</td><td class="num">S/ {{ number_format((float) $order->subtotal, 2, '.', ',') }}</td></tr>
        <tr><td>IGV</td><td class="num">S/ {{ number_format((float) $order->igv, 2, '.', ',') }}</td></tr>
        <tr class="grand"><td>Total</td><td class="num">S/ {{ number_format((float) $order->total, 2, '.', ',') }}</td></tr>
    </table>

    @if ($order->observations)
        <p class="note"><strong>Observaciones:</strong> {{ $order->observations }}</p>
    @endif

    <div class="signatures">
        <div>Firma del cliente</div>
        <div>Firma del taller</div>
    </div>

    <p class="note">Documento interno sin valor tributario. El comprobante electrónico se emite al registrar la venta.</p>
</div>
</body>
</html>
