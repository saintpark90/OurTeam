import { useEffect, useState } from 'react'
import {
  createGroup,
  fetchGroupLeaderboard,
  fetchGroupMembers,
  joinGroup,
  leaveGroup,
  listMyGroups,
} from '../lib/store'

export default function GroupsPage({ userId }) {
  const [groups, setGroups] = useState([])
  const [active, setActive] = useState(null)
  const [members, setMembers] = useState([])
  const [board, setBoard] = useState([])
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')

  const reload = async () => {
    const gs = await listMyGroups(userId)
    setGroups(gs)
    const next = gs.find((g) => g.id === active)?.id || gs[0]?.id || null
    setActive(next)
    return next
  }

  useEffect(() => {
    reload().catch((e) => setError(e.message))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  useEffect(() => {
    if (!active) {
      setMembers([])
      setBoard([])
      return
    }
    Promise.all([fetchGroupMembers(active), fetchGroupLeaderboard(active)])
      .then(([m, b]) => {
        setMembers(m)
        setBoard(b)
      })
      .catch((e) => setError(e.message))
  }, [active])

  const current = groups.find((g) => g.id === active)

  return (
    <div>
      {error ? <p className="error">{error}</p> : null}
      <section className="card">
        <h2>그룹 만들기</h2>
        <div className="row">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="모임 이름" />
          <button
            type="button"
            className="btn"
            onClick={async () => {
              setError('')
              try {
                const g = await createGroup(userId, name || '우리 모임')
                setName('')
                const gs = await listMyGroups(userId)
                setGroups(gs)
                setActive(g.id)
              } catch (e) {
                setError(e.message)
              }
            }}
          >
            생성
          </button>
        </div>
      </section>

      <section className="card">
        <h2>초대코드로 참여</h2>
        <div className="row">
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="예: A1B2C3" />
          <button
            type="button"
            className="btn"
            onClick={async () => {
              setError('')
              try {
                const g = await joinGroup(userId, code)
                setCode('')
                const gs = await listMyGroups(userId)
                setGroups(gs)
                setActive(g.id)
              } catch (e) {
                setError(e.message)
              }
            }}
          >
            참여
          </button>
        </div>
      </section>

      <section className="card">
        <h2>내 그룹</h2>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          {groups.map((g) => (
            <button
              key={g.id}
              type="button"
              className={`group-chip ${active === g.id ? 'active' : ''}`}
              onClick={() => setActive(g.id)}
            >
              {g.name}
            </button>
          ))}
        </div>
        {current ? (
          <>
            <p>
              초대코드 <strong>{current.invite_code}</strong>
            </p>
            <button type="button" className="btn ghost" onClick={() => leaveGroup(userId, current.id).then(reload)}>
              이 그룹 나가기
            </button>
          </>
        ) : (
          <p className="muted">아직 속한 그룹이 없습니다.</p>
        )}
      </section>

      <section className="card">
        <h2>멤버</h2>
        {members.map((m) => (
          <div key={m.user_id} className="lineup-item">
            <span>{m.display_name}</span>
            <span className="muted">{m.role}</span>
          </div>
        ))}
      </section>

      <section className="card">
        <h2>그룹 직관 순위</h2>
        <p className="muted">같은 그룹 멤버만 보입니다. 승률은 각자 응원 구단 기준입니다.</p>
        <table className="table">
          <thead>
            <tr><th>이름</th><th>경기</th><th>승무패</th><th>승률</th></tr>
          </thead>
          <tbody>
            {board.map((row) => (
              <tr key={row.user_id}>
                <td>{row.display_name}</td>
                <td>{row.games}</td>
                <td>{row.wins}·{row.draws}·{row.losses}</td>
                <td>{row.win_rate}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}
