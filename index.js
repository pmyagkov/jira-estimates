// assume JIRA has lodash embedded

// can't use class because of a redeclare issue
function Issue (issueNode, sectionName) {
    const PRIORITY_SELECTOR = '.ghx-priority'
    const TITLE_SELECTOR = '.ghx-summary .ghx-inner'
    const ORIGINAL_ESTIMATE_SELECTOR = '.ghx-statistic-badge'
    const REMAINING_ESTIMATE_SELECTOR = `.ghx-plan-extra-fields .ghx-extra-field-content`

    this._sprint = sectionName
    this._title = issueNode.querySelector(TITLE_SELECTOR).innerText
    this._originalEstimate = this.processEstimate(issueNode.querySelector(ORIGINAL_ESTIMATE_SELECTOR).innerText)
    this._remainingEstimate = this.processEstimate(issueNode.querySelector(REMAINING_ESTIMATE_SELECTOR).innerText)

    const priorityNode = issueNode.querySelector(PRIORITY_SELECTOR)
    this._priority = priorityNode ? priorityNode.getAttribute('title').toLowerCase() : 'flagged'
}

Issue.prototype.processEstimate = function (estimate) {
    // parse both `1 day, 4 hours` and `1d 4h`
    const ESTIMATE_PARSE_RE = /(?:(\d+)(?:(?: days?)|d))?(?:(?:,)? )?(?:(\d)(?:(?: hours?)|h))?/

    const parsedEstimate = estimate.match(ESTIMATE_PARSE_RE)
    if (!parsedEstimate || !parsedEstimate[1] && !parsedEstimate[2]) {
        return null
    }

    const hours = parseInt(parsedEstimate[2] || 0)
    const days = parseInt(parsedEstimate[1] || 0)
    return days * 8 + hours
}

Issue.prototype.isOverEstimated = function () {
    return this._remainingEstimate && this._originalEstimate && this._remainingEstimate > this._originalEstimate
}

Issue.prototype.isUnestimated = function () {
    return !this._originalEstimate
}

Issue.prototype.getPriority = function () {
    return this._priority
}

Issue.prototype.getNumberEstimate = function (which /* original | remaining */) {
    const key = which === 'remaining' ? '_remainingEstimate' : '_originalEstimate'
    return Number.isFinite(this[key]) ? this[key] : 0
}

Issue.prototype.getEstimatePrintArgs = function (remainingEstimate, originalEstimate) {
    let value = '-'
    let color = Issue.badColor
    if (Number.isFinite(originalEstimate)) {
        if (!Number.isFinite(remainingEstimate) || originalEstimate === remainingEstimate) {
            value = `${ originalEstimate }h`
            color = Issue.normalColor
        } else {
            value = `${ remainingEstimate }h/${ originalEstimate }h`
            color = remainingEstimate < originalEstimate ? Issue.goodColor : Issue.badColor
        }
    }

    return {
        value: `[${ value }]`,
        color,
    }
}

Issue.prototype.print = function () {
    const { value, color } = this.getEstimatePrintArgs(this._remainingEstimate, this._originalEstimate)
    console.log(`%c${ value }%c ${ this._title }`, `color: ${ color }`, 'color: black')
}

Issue.normalColor = '#d39c3f'
Issue.badColor = '#e5493a'
Issue.goodColor = '#67ab49'
Issue.textColor = 'black'


function calculateSection (sectionNode) {
    const SECTION_NAME_SELECTOR = '.ghx-name'

    const sectionName = sectionNode.querySelector(SECTION_NAME_SELECTOR).innerText
    
    const issueNodes = sectionNode.querySelectorAll('.ghx-backlog-card:not(.ghx-filtered)')
    const issues = Array.from(issueNodes).map((issueNode) => new Issue(issueNode, sectionName))

    return { sectionName, issues }
}

function getSectionPrintArgs (sectionName, issues) {
    const sectionInfo = issues.reduce(
        (result, issue) => Object.assign({}, result, {
            remainingEstimate: (result.remainingEstimate || 0) + issue.getNumberEstimate('remaining'),
            originalEstimate: (result.originalEstimate || 0) + issue.getNumberEstimate('original'),
            unestimatedCount: (result.unestimatedCount || 0) + Number(issue.isUnestimated()),
            overEstimatedCount: (result.overEstimatedCount || 0) + Number(issue.isOverEstimated()),
        }, {})
    )

    const { remainingEstimate, originalEstimate, unestimatedCount, overEstimatedCount } = sectionInfo

    const { value, color } = Issue.prototype.getEstimatePrintArgs(remainingEstimate, originalEstimate)

    const colors = [color, Issue.black]
    let stringValue = `%c${ value }%c ${ sectionName }: ${ issues.length } issues`
    if (unestimatedCount) {
        stringValue += ` %c${ unestimatedCount } unestimated`
        colors.push(Issue.badColor)
    }

    if (overEstimatedCount) {
        stringValue += ` %c${ overEstimatedCount } overestimated`
        colors.push(Issue.badColor)
    }

    return {
        value: stringValue,
        colors,
    }
}

function printSection (sectionName, issues) {
    const { value, colors } = getSectionPrintArgs(sectionName, issues)

    console.groupCollapsed(
        value,
        ...colors.map((color) => `color: ${ color }`)
    )

    issues.forEach((issue) => issue.print())

    console.groupEnd()
}

function printPriority (priority, issues) {
    const priorityImages = {
        'flagged': 'data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiIHN0YW5kYWxvbmU9Im5vIj8+Cjxzdmcgd2lkdGg9IjE2cHgiIGhlaWdodD0iMTZweCIgdmlld0JveD0iMCAwIDE2IDE2IiB2ZXJzaW9uPSIxLjEiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgeG1sbnM6eGxpbms9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkveGxpbmsiPgogICAgPCEtLSBHZW5lcmF0b3I6IFNrZXRjaCA0MC4zICgzMzgzOSkgLSBodHRwOi8vd3d3LmJvaGVtaWFuY29kaW5nLmNvbS9za2V0Y2ggLS0+CiAgICA8dGl0bGU+QXJ0Ym9hcmQgMjwvdGl0bGU+CiAgICA8ZGVzYz5DcmVhdGVkIHdpdGggU2tldGNoLjwvZGVzYz4KICAgIDxkZWZzPgogICAgICAgIDxwb2x5Z29uIGlkPSJwYXRoLTEiIHBvaW50cz0iMC41IDAgMCAwIDAgMTQgMSAxNCAxIDggMTIgOCA5IDQgMTIgMCI+PC9wb2x5Z29uPgogICAgPC9kZWZzPgogICAgPGcgaWQ9IlBhZ2UtMSIgc3Ryb2tlPSJub25lIiBzdHJva2Utd2lkdGg9IjEiIGZpbGw9Im5vbmUiIGZpbGwtcnVsZT0iZXZlbm9kZCI+CiAgICAgICAgPGcgaWQ9IkFydGJvYXJkLTIiPgogICAgICAgICAgICA8ZyBpZD0iR3JvdXAiIHRyYW5zZm9ybT0idHJhbnNsYXRlKDIuMDAwMDAwLCAxLjAwMDAwMCkiPgogICAgICAgICAgICAgICAgPG1hc2sgaWQ9Im1hc2stMiIgZmlsbD0id2hpdGUiPgogICAgICAgICAgICAgICAgICAgIDx1c2UgeGxpbms6aHJlZj0iI3BhdGgtMSI+PC91c2U+CiAgICAgICAgICAgICAgICA8L21hc2s+CiAgICAgICAgICAgICAgICA8ZyBpZD0icGF0aC0xIj48L2c+CiAgICAgICAgICAgICAgICA8cG9seWdvbiBpZD0icGF0aC0xIiBzdHJva2U9IiNEOTNBMzUiIHN0cm9rZS13aWR0aD0iMiIgZmlsbD0iI0Q5M0EzNSIgbWFzaz0idXJsKCNtYXNrLTIpIiBwb2ludHM9IjAgMCAwIDE0IDEgMTQgMSA4IDEyIDggOSA0IDEyIDAgMC41IDAiPjwvcG9seWdvbj4KICAgICAgICAgICAgPC9nPgogICAgICAgIDwvZz4KICAgIDwvZz4KPC9zdmc+',
        'highest': 'https://tangle.atlassian.net/images/icons/priorities/highest.svg',
        'high': 'https://tangle.atlassian.net/images/icons/priorities/high.svg',
        'medium': 'https://tangle.atlassian.net/images/icons/priorities/medium.svg',
        'low': 'https://tangle.atlassian.net/images/icons/priorities/low.svg',
        'lowest': 'https://tangle.atlassian.net/images/icons/priorities/lowest.svg',
        'unprioritized': 'https://tangle.atlassian.net/images/icons/priorities/blocker.svg',
    }

    if (issues.length === 0) {
        return
    }

    const { colors, value } = getSectionPrintArgs(`  ${ priority }`, issues)
    const styles = colors.map((color) => `color: ${ color };`)
    styles[1] = `width: 16px; height: 16px; background-image: url('${ priorityImages[priority] }'); background-repeat: no-repeat;`

    console.log(
        value,
        ...styles,
    )

}

function calculateOverallEstimate () {
    const SECTION_SELECTOR = '.ghx-backlog-container'
    console.clear()
    
    const priorityOrder = [
        'flagged',
        'highest',
        'high',
        'medium',
        'low',
        'lowest',
        'unprioritized',
    ]


    const allIssues = []

    const overallEstimateObj = Array.from(document.querySelectorAll(SECTION_SELECTOR))
        .map(calculateSection)
        .forEach((sectionObj) => {
            const { sectionName, issues } = sectionObj
            allIssues.push(...issues)
            
            printSection(sectionName, issues)
            /*
            issues.forEach((issue) => {
                
                
                priorityCounts[issue.getPriority()] += issue.getNumberEstimate('original')
            })*/
            
         
        })

    // const { originalEstimate, count } = overallEstimateObj
    const { value, colors } = getSectionPrintArgs('Overall', allIssues)
    console.groupCollapsed(
        value,
        ...colors.map((color) => `color: ${ color }`)
    )

    const issuesByPriority = _(allIssues)
        .chain()
        .groupBy((issue) => issue.getPriority())
        .sortBy((issues, priority) => priorityOrder.findIndex((p) => p === priority))
        .forEach((issues) => issues.length ? printPriority(issues[0].getPriority(), issues) : {})
        .value()

    console.groupEnd()
}

calculateOverallEstimate()
