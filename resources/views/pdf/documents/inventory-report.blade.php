@php($numeric = $numericColumns ?? [])
<x-report-layout
    :company="$company"
    :report-title="$reportTitle"
    :report-subtitle="$reportSubtitle ?? null"
    :stats="$stats ?? []"
>
    <table class="data">
        <thead>
            <tr>
                @foreach ($columns as $index => $column)
                    <th class="{{ in_array($index, $numeric, true) ? 'num' : '' }}">{{ $column }}</th>
                @endforeach
            </tr>
        </thead>
        <tbody>
            @forelse ($rows as $row)
                <tr class="{{ $loop->even ? 'zebra' : '' }}">
                    @foreach (array_values($row) as $index => $cell)
                        <td class="{{ in_array($index, $numeric, true) ? 'num' : '' }}">{{ $cell }}</td>
                    @endforeach
                </tr>
            @empty
                <tr>
                    <td colspan="{{ count($columns) }}" class="empty">{{ $emptyMessage ?? 'Nothing to report.' }}</td>
                </tr>
            @endforelse
        </tbody>
    </table>
</x-report-layout>
