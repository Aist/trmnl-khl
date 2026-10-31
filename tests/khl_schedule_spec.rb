# frozen_string_literal: true

require 'json'

RSpec.describe 'KHL Schedule' do
  def fixture(name)
    JSON.parse(File.read(File.join(__dir__, 'fixtures', "#{name}.json")))
  end

  def payload(name)
    { events: fixture(name) }
  end

  let(:custom_fields) { { layout: 'auto', max_games: 'auto', show_date: true } }
  let(:test_device) { { width: 800, height: 480, bit_depth: 2 } }
  let(:mocks) do
    {
      'https://khl.api.webcaster.pro/api/khl_mobile/data.json*' => { json: {} },
      'https://khl.api.webcaster.pro/api/khl_mobile/events_v2.json*' => { json: fixture('today') },
    }
  end

  it_behaves_like 'a publishable recipe'

  it 'keeps games whose start time has passed until Moscow midnight' do
    run = trmnl.transform(data: payload('today'), now: '2026-10-31T16:00:00Z', custom_fields:, device: test_device)

    expect(run.error).to be_nil
    expect(run.data['status']).to eq('ok')
    expect(run.data['is_today']).to be(true)
    expect(run.data['games'].size).to eq(1)
    expect(run.data['games'].first).to include('home' => 'Автомобилист', 'time' => '15:00')
  end

  it 'switches to the full next game day when today has no games' do
    run = trmnl.transform(data: payload('future'), now: '2026-10-31T08:00:00Z', custom_fields:, device: test_device)

    expect(run.error).to be_nil
    expect(run.data['is_today']).to be(false)
    expect(run.data['games'].size).to eq(2)
    expect(run.data['game_date']).to eq('1 ноября')
  end

  it 'uses Russian copy and date formatting' do
    run = trmnl.transform(data: payload('future'), now: '2026-10-31T08:00:00Z', custom_fields:, device: test_device)

    expect(run.error).to be_nil
    expect(run.data['upcoming']).to eq('Ближайшие игры ·')
    expect(run.data['game_date']).to eq('1 ноября')
  end

  it 'has an orderly empty state in the off-season' do
    run = trmnl.transform(data: { events: [] }, now: '2026-07-10T10:00:00Z', custom_fields:, device: test_device)

    expect(run.error).to be_nil
    expect(run.data).to include('status' => 'empty', 'seasonOver' => 'Сезон завершен!', 'season_days' => 53, 'games' => [])

    screen = trmnl.render(data: { events: [] }, now: '2026-07-10T10:00:00Z', custom_fields:, device: test_device)
    expect(screen).to have_text('Сезон завершен!')
    expect(screen).to have_text('~ 53 дней до начала сезона')
    expect(screen).to have_no_leaked_text
  end

  it 'does not leak an unexpected API object to the display' do
    run = trmnl.transform(data: { events: { error: 'unexpected' } }, custom_fields:, device: test_device)

    expect(run.error).to be_nil
    expect(run.data).to include('status' => 'error', 'games' => [])
  end

  it 'renders an error state after an API timeout' do
    timeout = {
      'https://khl.api.webcaster.pro/api/khl_mobile/data.json*' => { json: {} },
      'https://khl.api.webcaster.pro/api/khl_mobile/events_v2.json*' => { status: 599 },
    }
    screen = trmnl.render(now: '2026-10-31T08:00:00Z', custom_fields:, mocks: timeout)

    expect(screen).to have_text('Расписание временно недоступно')
    expect(screen).to have_no_leaked_text
  end
end

