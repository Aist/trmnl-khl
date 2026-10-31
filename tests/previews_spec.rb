# frozen_string_literal: true

require 'json'

RSpec.describe 'KHL Schedule previews' do
  let(:data) do
    { events: JSON.parse(File.read(File.join(__dir__, 'fixtures', 'preview.json'))) }
  end
  let(:custom_fields) { { layout: 'auto', max_games: 'auto', show_date: true } }

  {
    'full-800x480' => ['full', { width: 800, height: 480, bit_depth: 2 }],
    'vertical-half-400x480' => ['half_vertical', { width: 400, height: 480, bit_depth: 2 }],
    'horizontal-half-800x240' => ['half_horizontal', { width: 800, height: 240, bit_depth: 2 }],
    'quadrant-400x240' => ['quadrant', { width: 400, height: 240, bit_depth: 2 }],
  }.each do |name, (view, device)|
    it "renders #{name}" do
      screen = trmnl.render(view:, device:, data:, now: '2026-10-31T08:00:00Z', custom_fields:)

      expect(screen).to have_no_problems
      expect(screen).to have_no_overflow
      expect(screen).to match_snapshot
    end
  end
end

